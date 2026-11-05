/** A file may export one legacy plugin or an explicit resource bundle. */
export interface ParsedPluginFile {
    id?: string;
    name?: string;
    plugins: IPlugin.IPluginDefine[];
}

export function parsePluginExport(value: any): ParsedPluginFile {
    value = value?.default ?? value;
    if (value && typeof value.platform === "string" && value.platform.trim()) {
        return { plugins: [value] };
    }
    if (!value || typeof value.id !== "string" || !value.id.trim() ||
        typeof value.name !== "string" || !value.name.trim() ||
        !Array.isArray(value.plugins) || !value.plugins.length) {
        throw new Error("插件必须导出单资源对象，或包含 id、name、plugins 的多资源包");
    }
    const names = new Set<string>();
    const plugins = value.plugins.map((entry: IPlugin.IPluginDefine) => {
        if (!entry || typeof entry.platform !== "string" || !entry.platform.trim() || names.has(entry.platform)) {
            throw new Error("多资源包包含无效或重复的资源名称");
        }
        names.add(entry.platform);
        return { ...entry, version: entry.version ?? value.version, srcUrl: entry.srcUrl ?? value.srcUrl };
    });
    return { id: value.id.trim(), name: value.name.trim(), plugins };
}
