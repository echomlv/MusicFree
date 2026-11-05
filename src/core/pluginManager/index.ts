import {
    emptyFunction,
    localPluginHash,
    localPluginPlatform,
} from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import {
    IInstallPluginConfig,
    IInstallPluginResult,
    IPluginManager,
} from "@/types/core/pluginManager";
import { removeAllMediaExtra } from "@/utils/mediaExtra";
import axios from "axios";
import { compare } from "compare-versions";
import EventEmitter from "eventemitter3";
import { readAsStringAsync } from "expo-file-system";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { readDir, readFile, unlink, writeFile } from "react-native-fs";
import { errorLog } from "../../utils/log";
import pluginMeta from "./meta";
import { localFilePlugin, Plugin, PluginState } from "./plugin";
import i18n from "../i18n";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse } from "@/utils/jsonUtil";
import { IInjectable } from "@/types/infra";
import { IAppConfig } from "@/types/core/config";
import delay from "@/utils/delay";
import { groupAllowsPlugin, groupForPlugin, PluginGroup, registerBundleGroup } from "./groups";

const pluginsAtom = atom<Plugin[]>([]);
const pluginCacheStore = getOrCreateMMKV("plugin.cache");

const ee = new EventEmitter<{
    "order-updated": () => void;
    "groups-updated": () => void;
    "enabled-updated": (pluginName: string, enabled: boolean) => void;
}>();

class PluginManager implements IPluginManager, IInjectable {
    private appConfigService!: IAppConfig;
    private installQueue: Promise<unknown> = Promise.resolve();

    injectDependencies(config: IAppConfig): void {
        this.appConfigService = config;
    }

    /**
     * 获取当前存储的插件列表
     * @returns 插件实例数组
     */
    private getPlugins() {
        return getDefaultStore().get(pluginsAtom);
    }

    /**
     * 更新存储中的插件列表
     * @param plugins - 要设置的插件实例数组
     */
    private setPlugins(plugins: Plugin[]) {
        getDefaultStore().set(pluginsAtom, plugins);

        // 清理缓存中已卸载的插件
        const cachedKeys = pluginCacheStore.getAllKeys();
        cachedKeys.forEach(key => {
            if (!plugins.find(it => it.path === key)) {
                pluginCacheStore.delete(key);
            }
        });

        plugins.forEach(it => {
            this.updatePluginCache(it);
        });
    }

    private updatePluginCache(plugin: Plugin) {
        if (!plugin.path) return;
        const entries = this.getPlugins().filter(item => item.path === plugin.path);
        pluginCacheStore.set(plugin.path, JSON.stringify({ schema: 2, entries: entries.map(item => ({
            name: item.name, hash: item.hash, path: item.path, instance: item.instance,
            supportedMethods: [...item.supportedMethods], fileHash: item.fileHash,
            entryName: item.entryName, bundleId: item.bundleId, bundleName: item.bundleName,
        })) }));
    }

    private registerGroups(plugins: Plugin[], restoreMissing = false) {
        let state = pluginMeta.getPluginGroups();
        const previous = JSON.stringify(state);
        const bundles = new Map<string, Plugin[]>();
        plugins.forEach(plugin => {
            if (plugin.bundleId) bundles.set(plugin.bundleId, [...(bundles.get(plugin.bundleId) ?? []), plugin]);
        });
        bundles.forEach((entries, id) => {
            state = registerBundleGroup(state, id, entries[0].bundleName || id, entries.map(entry => entry.name), restoreMissing);
        });
        pluginMeta.setPluginGroups(state);
        return previous !== JSON.stringify(state);
    }

    async setup() {
        await pluginMeta.migratePluginMeta();
        const files = await readDir(pathConst.pluginPath);
        const plugins: Plugin[] = [];
        for (const file of files) {
            if (!file.isFile() || !file.name?.endsWith(".js")) continue;
            try {
                let cached = this.appConfigService.getConfig("basic.lazyLoadPlugin") &&
                    safeParse(pluginCacheStore.getString(file.path));
                const code = await readFile(file.path, "utf8");
                const hash = Plugin.hashCode(code);
                if (cached) {
                    const entries = cached.schema === 2 ? cached.entries : [cached];
                    if (!Array.isArray(entries) || !entries.length || entries.some((entry: any) => (entry.fileHash || entry.hash) !== hash)) cached = null;
                }
                const entries: Plugin[] = cached ? (cached.schema === 2 ? cached.entries : [cached]).map((props: any) =>
                    new Plugin(null, file.path, { ...props, path: file.path, loadFuncCode: () => readFile(file.path, "utf8") }),
                ) : Plugin.loadFile(code, file.path);
                for (const plugin of entries) {
                    if (plugin.bundleId && pluginMeta.getRemovedBundleEntries(plugin.bundleId).includes(plugin.name)) continue;
                    const previous = plugins.findIndex(item => item.name === plugin.name);
                    if (previous >= 0) {
                        if (compare(plugins[previous].instance.version || "0", plugin.instance.version || "0", ">")) continue;
                        plugins.splice(previous, 1);
                    }
                    plugins.push(plugin);
                }
            } catch (error: any) {
                errorLog("插件文件加载失败", { path: file.path, message: error?.message });
            }
        }
        this.registerGroups(plugins);
        this.setPlugins(plugins);
        Plugin.injectDependencies(this);
        delay(10_000, true).then(async () => {
            for (const plugin of plugins) {
                if (plugin.state === PluginState.Initializing) {
                    await plugin.ensureMounted();
                    this.updatePluginCache(plugin);
                }
            }
        });
    }

    private installCode(code: string, config: IInstallPluginConfig = {}): Promise<IInstallPluginResult> {
        const operation = this.installQueue.then(() => this.installFile(code, config));
        this.installQueue = operation.catch(() => undefined);
        return operation;
    }

    private async installFile(code: string, config: IInstallPluginConfig): Promise<IInstallPluginResult> {
        let path: string | undefined;
        try {
            let incoming = Plugin.loadFile(code, "");
            const first = incoming[0];
            const existing = this.getPlugins();
            const replacing = existing.filter(item => first.bundleId ? item.bundleId === first.bundleId : item.name === first.name);
            if (!first.bundleId && replacing.some(item => item.bundleId)) throw new Error("同名资源属于插件包，请更新整个包或先卸载该资源");
            if (incoming.some(entry => existing.some(item => item.name === entry.name && !replacing.includes(item)))) {
                throw new Error("资源名称已被其他插件使用，未安装任何资源");
            }
            if (!config.notCheckVersion && replacing.some(old => {
                const next = incoming.find(item => item.name === old.name);
                return next && compare(old.instance.version || "0", next.instance.version || "0", ">");
            })) return { success: false, message: "已安装更新版本的插件", pluginName: first.bundleName || first.name };
            if (first.bundleId && config.restoreRemoved === false) {
                const removed = pluginMeta.getRemovedBundleEntries(first.bundleId);
                incoming = incoming.filter(entry => !removed.includes(entry.name));
            }
            if (incoming.length === replacing.length && incoming.every(entry => replacing.some(old => old.hash === entry.hash))) {
                if (first.bundleId && config.restoreRemoved !== false && this.registerGroups(incoming, true)) this.groupsChanged();
                return { success: true, message: "插件已安装", pluginName: first.bundleName || first.name, pluginHash: first.hash, pluginNames: incoming.map(item => item.name) };
            }
            path = `${pathConst.pluginPath}${nanoid()}.js`;
            await writeFile(path, code, "utf8");
            incoming.forEach(entry => {
                entry.path = path!;
            });
            if (first.bundleId && config.restoreRemoved !== false) pluginMeta.setRemovedBundleEntries(first.bundleId, []);
            this.registerGroups(incoming, config.restoreRemoved !== false);
            const next = [...existing.filter(item => !replacing.includes(item)), ...incoming];
            this.setPlugins(next);
            for (const oldPath of new Set(replacing.map(item => item.path))) {
                if (oldPath && !next.some(item => item.path === oldPath)) await unlink(oldPath).catch(emptyFunction);
            }
            return { success: true, pluginName: first.bundleName || first.name, pluginHash: incoming[0]?.hash, pluginNames: incoming.map(item => item.name) };
        } catch (error: any) {
            if (path) await unlink(path).catch(emptyFunction);
            return { success: false, message: error?.message || "插件无法解析" };
        }
    }

    /**
     * 从本地文件安装插件
     * @param pluginPath - 插件文件路径
     * @param config - 安装配置选项
     * @param config.notCheckVersion - 为true时跳过版本检查
     * @param config.useExpoFs - 为true时使用Expo文件系统代替React Native的文件系统
     * @returns 安装结果，包含成功状态和相关信息
     */
    async installPluginFromLocalFile(
        pluginPath: string,
        config?: IInstallPluginConfig & {
            useExpoFs?: boolean;
        },
    ): Promise<IInstallPluginResult> {
        const code = config?.useExpoFs ? await readAsStringAsync(pluginPath) : await readFile(pluginPath, "utf8");
        return code ? this.installCode(code, config) : { success: false, message: "插件无法识别" };
    }

    async installPluginFromUrl(url: string, config?: IInstallPluginConfig): Promise<IInstallPluginResult> {
        try {
            const code = (await axios.get(url, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache", Expires: "0" } })).data;
            if (typeof code !== "string" || !code) return { success: false, message: "插件无法识别", pluginUrl: url };
            return { ...await this.installCode(code, config), pluginUrl: url };
        } catch (error: any) {
            return { success: false, message: error?.message || "插件下载失败", pluginUrl: url };
        }
    }

    /**
     * 通过哈希值卸载插件
     * @param hash - 要卸载的插件哈希值
     */
    uninstallPlugin(hash: string) {
        const operation = this.installQueue.then(() => this.removePlugin(hash));
        this.installQueue = operation.catch(() => undefined);
        return operation;
    }

    private async removePlugin(hash: string) {
        const plugins = this.getPlugins();
        const target = plugins.find(item => item.hash === hash);
        if (!target) return;
        const next = plugins.filter(item => item !== target);
        if (!next.some(item => item.path === target.path)) await unlink(target.path);
        if (target.bundleId) pluginMeta.setRemovedBundleEntries(target.bundleId,
            [...new Set([...pluginMeta.getRemovedBundleEntries(target.bundleId), target.name])]);
        this.setPlugins(next);
        removeAllMediaExtra(target.name);
    }

    /**
     * 卸载系统中的所有插件
     * 同时清理媒体额外数据并删除插件文件
     */
    uninstallAllPlugins() {
        const operation = this.installQueue.then(async () => {
            const plugins = this.getPlugins();
            const files = await readDir(pathConst.pluginPath);
            await Promise.all(files.filter(file => file.isFile()).map(file => unlink(file.path).catch(emptyFunction)));
            plugins.forEach(plugin => removeAllMediaExtra(plugin.name));
            this.setPlugins([]);
        });
        this.installQueue = operation.catch(() => undefined);
        return operation;
    }

    /**
     * 使用插件的源URL更新插件
     * @param plugin - 要更新的插件实例
     * @throws 如果插件没有源URL或更新失败时抛出错误
     */
    async updatePlugin(plugin: Plugin) {
        const updateUrl = plugin.instance.srcUrl;
        if (!updateUrl) {
            throw new Error("没有更新源");
        }
        try {
            const result = await this.installPluginFromUrl(updateUrl, { restoreRemoved: false });
            if (!result.success) throw new Error(result.message);
        } catch (e: any) {
            if (e.message === "插件已安装") {
                throw new Error(i18n.t("checkUpdate.error.latestVersion"));
            } else {
                throw e;
            }
        }
    }

    /**
     * 通过媒体项的平台信息获取对应的插件
     * @param mediaItem - 包含平台信息的媒体项
     * @returns 与媒体平台匹配的插件实例或undefined
     */
    getByMedia(mediaItem: ICommon.IMediaBase) {
        return this.getByName(mediaItem?.platform);
    }

    /**
     * 通过名称获取插件
     * @param name - 要查找的插件名称
     * @returns 匹配名称的插件实例或本地文件插件
     */
    getByName(name: string) {
        return name === localPluginPlatform
            ? localFilePlugin
            : this.getPlugins().find(_ => _.name === name);
    }

    /**
     * 通过哈希值获取插件
     * @param hash - 要查找的插件哈希值
     * @returns 匹配哈希的插件实例或本地文件插件
     */
    getByHash(hash: string) {
        return hash === localPluginHash
            ? localFilePlugin
            : this.getPlugins().find(_ => _.hash === hash);
    }

    /**
     * 获取所有已启用的插件
     * @returns 已启用的插件实例数组
     */
    getEnabledPlugins() {
        return this.getPlugins().filter(it =>
            this.isPluginEnabled(it),
        );
    }

    /**
     * 获取按顺序排序的所有插件
     * @returns 按定义顺序排序的插件实例数组
     */
    getSortedPlugins() {
        const order = pluginMeta.getPluginOrder();
        return [...this.getPlugins()].sort((a, b) =>
            (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity) < 0
                ? -1
                : 1,
        );
    }

    /**
     * 获取所有支持搜索功能的已启用插件
     * @param supportedSearchType - 可选的搜索媒体类型过滤器
     * @returns 可搜索的插件实例数组
     */
    getSearchablePlugins(supportedSearchType?: ICommon.SupportMediaType) {
        return this.getPlugins().filter(
            it =>
                this.isPluginEnabled(it) &&
                it.supportedMethods.has("search") &&
                (supportedSearchType && it.instance.supportedSearchType
                    ? it.instance.supportedSearchType.includes(
                        supportedSearchType,
                    )
                    : true),
        );
    }

    /**
     * 获取所有支持搜索功能的已启用插件，并按顺序排序
     * @param supportedSearchType - 可选的搜索媒体类型过滤器
     * @returns 按顺序排序的可搜索插件实例数组
     */
    getSortedSearchablePlugins(supportedSearchType?: ICommon.SupportMediaType) {
        const order = pluginMeta.getPluginOrder();
        return [...this.getSearchablePlugins(supportedSearchType)].sort(
            (a, b) =>
                (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity) < 0
                    ? -1
                    : 1,
        );
    }

    /**
     * 获取所有实现特定功能的已启用插件
     * @param ability - 要检查的方法/功能名称
     * @returns 具有指定功能的插件实例数组
     */
    getPluginsWithAbility(ability: keyof IPlugin.IPluginInstanceMethods) {
        return this.getPlugins().filter(
            it =>
                this.isPluginEnabled(it) &&
                it.supportedMethods.has(ability),
        );
    }

    /**
     * 获取所有实现特定功能的已启用插件，并按顺序排序
     * @param ability - 要检查的方法/功能名称
     * @returns 按顺序排序的具有指定功能的插件实例数组
     */
    getSortedPluginsWithAbility(ability: keyof IPlugin.IPluginInstanceMethods) {
        const order = pluginMeta.getPluginOrder();
        return [...this.getPluginsWithAbility(ability)].sort((a, b) =>
            (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity) < 0
                ? -1
                : 1,
        );
    }

    /**
     * 设置插件的启用状态并发送事件通知
     * @param plugin - 要修改的插件实例
     * @param enabled - 是否启用插件
     */
    setPluginEnabled(plugin: Plugin, enabled: boolean) {
        pluginMeta.setPluginEnabled(plugin.name, enabled);
        ee.emit("enabled-updated", plugin.name, this.isPluginEnabled(plugin));
        getDefaultStore().set(pluginsAtom, [...this.getPlugins()]);
    }

    /**
     * 检查插件是否已启用
     * @param plugin - 要检查的插件实例
     * @returns 表示插件是否启用的布尔值
     */
    isPluginEnabled(plugin: Plugin) {
        return pluginMeta.isPluginEnabled(plugin.name) && groupAllowsPlugin(pluginMeta.getPluginGroups(), plugin.name);
    }

    isPluginIndividuallyEnabled(plugin: Plugin) {
        return pluginMeta.isPluginEnabled(plugin.name);
    }

    getPluginGroups(): PluginGroup[] {
        return pluginMeta.getPluginGroups().groups;
    }

    getPluginGroup(plugin: Plugin) {
        return groupForPlugin(pluginMeta.getPluginGroups(), plugin.name);
    }

    private groupsChanged() {
        getDefaultStore().set(pluginsAtom, [...this.getPlugins()]);
        ee.emit("groups-updated");
        this.getPlugins().forEach(plugin => ee.emit("enabled-updated", plugin.name, this.isPluginEnabled(plugin)));
    }

    createPluginGroup(name: string) {
        name = name.trim();
        if (!name) throw new Error("请输入分组名称");
        const state = pluginMeta.getPluginGroups();
        if (state.groups.some(group => group.name === name)) throw new Error("分组名称已存在");
        const group: PluginGroup = { id: "user:" + nanoid(), name, enabled: true };
        state.groups.push(group);
        pluginMeta.setPluginGroups(state);
        this.groupsChanged();
        return group;
    }

    renamePluginGroup(id: string, name: string) {
        name = name.trim();
        const state = pluginMeta.getPluginGroups();
        const group = state.groups.find(item => item.id === id);
        if (!group || !name) throw new Error("请输入有效的分组名称");
        if (state.groups.some(item => item.id !== id && item.name === name)) throw new Error("分组名称已存在");
        group.name = name;
        pluginMeta.setPluginGroups(state);
        this.groupsChanged();
    }

    deletePluginGroup(id: string) {
        const state = pluginMeta.getPluginGroups();
        state.groups = state.groups.filter(group => group.id !== id);
        Object.keys(state.assignments).forEach(name => {
            if (state.assignments[name] === id) state.assignments[name] = null;
        });
        pluginMeta.setPluginGroups(state);
        this.groupsChanged();
    }

    setPluginGroupEnabled(id: string, enabled: boolean) {
        const state = pluginMeta.getPluginGroups();
        const group = state.groups.find(item => item.id === id);
        if (!group) throw new Error("分组不存在");
        group.enabled = enabled;
        pluginMeta.setPluginGroups(state);
        this.groupsChanged();
    }

    movePluginToGroup(plugin: Plugin, id: string | null) {
        const state = pluginMeta.getPluginGroups();
        if (id !== null && !state.groups.some(group => group.id === id)) throw new Error("分组不存在");
        state.assignments[plugin.name] = id;
        pluginMeta.setPluginGroups(state);
        this.groupsChanged();
    }

    /**
     * 设置插件的排序顺序并发送顺序更新事件
     * @param sortedPlugins - 按期望顺序排列的插件实例数组
     */
    setPluginOrder(sortedPlugins: Plugin[]) {
        const orderMap: Record<string, number> = {};
        sortedPlugins.forEach((plugin, index) => {
            orderMap[plugin.name] = index;
        });
        pluginMeta.setPluginOrder(orderMap);
        ee.emit("order-updated");
    }

    setUserVariables(plugin: Plugin, userVariables: Record<string, string>) {
        pluginMeta.setUserVariables(plugin.name, userVariables);
    }

    getUserVariables(plugin: Plugin) {
        return pluginMeta.getUserVariables(plugin.name);
    }

    setAlternativePluginName(plugin: Plugin, alternativePluginName: string) {
        pluginMeta.setAlternativePlugin(plugin.name, alternativePluginName);
    }

    getAlternativePluginName(plugin: Plugin) {
        return pluginMeta.getAlternativePlugin(plugin.name);
    }

    getAlternativePlugin(plugin: Plugin) {
        const alternativePluginName = this.getAlternativePluginName(plugin);
        if (alternativePluginName) {
            return this.getByName(alternativePluginName);
        }
        return null;
    }
}

const pluginManager = new PluginManager();

export const usePlugins = () => useAtomValue(pluginsAtom);

export function useSortedPlugins() {
    const plugins = useAtomValue(pluginsAtom);
    const [sortedPlugins, setSortedPlugins] = useState<Plugin[]>(
        pluginManager.getSortedPlugins(),
    );

    useEffect(() => {
        const callback = () => {
            const order = pluginMeta.getPluginOrder();
            setSortedPlugins(
                [...plugins].sort((a, b) =>
                    (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity) <
                    0
                        ? -1
                        : 1,
                ),
            );
        };

        ee.on("order-updated", callback);
        callback();
        return () => {
            ee.off("order-updated", callback);
        };
    }, [plugins]);

    return sortedPlugins;
}

export function usePluginEnabled(plugin: Plugin, individual = false) {
    const readEnabled = () => individual ? pluginManager.isPluginIndividuallyEnabled(plugin) : pluginManager.isPluginEnabled(plugin);
    const [enabled, setEnabled] = useState(
        readEnabled(),
    );

    useEffect(() => {
        const callback = (pluginName: string, _enabled: boolean) => {
            if (pluginName === plugin?.name) {
                setEnabled(readEnabled());
            }
        };

        setEnabled(readEnabled());
        ee.on("enabled-updated", callback);
        return () => {
            ee.off("enabled-updated", callback);
        };
    }, [plugin, individual]);

    return enabled;
}

export default pluginManager;
export { Plugin };
