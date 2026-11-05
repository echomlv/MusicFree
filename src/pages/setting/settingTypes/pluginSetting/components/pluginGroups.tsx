import React, { useState } from "react";
import { SectionList, StyleSheet, TouchableOpacity, View } from "react-native";
import PluginManager, { Plugin } from "@/core/pluginManager";
import { PluginGroup } from "@/core/pluginManager/groups";
import ThemeText from "@/components/base/themeText";
import ThemeSwitch from "@/components/base/switch";
import IconButton from "@/components/base/iconButton";
import Empty from "@/components/base/empty";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog } from "@/components/dialogs/useDialog";
import Toast from "@/utils/toast";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import PluginItem from "./pluginItem";

export function editPluginGroup(group?: PluginGroup) {
    showPanel("SimpleInput", {
        title: group ? "重命名分组" : "新建分组",
        placeholder: group?.name || "输入分组名称",
        initialValue: group?.name,
        maxLength: 40,
        onOk(name, close) {
            try {
                if (group) PluginManager.renamePluginGroup(group.id, name);
                else PluginManager.createPluginGroup(name);
                close();
            } catch (error: any) {
                Toast.warn(error.message);
            }
        },
    });
}

export default function PluginGroups({ plugins }: { plugins: Plugin[] }) {
    const colors = useColors();
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const groups = PluginManager.getPluginGroups();
    const sections = groups.map(group => {
        const members = plugins.filter(plugin => PluginManager.getPluginGroup(plugin)?.id === group.id);
        return { key: group.id, title: group.name, group: group as PluginGroup | undefined, count: members.length, data: collapsed[group.id] ? [] : members };
    });
    const ungrouped = plugins.filter(plugin => !PluginManager.getPluginGroup(plugin));
    if (ungrouped.length) sections.push({ key: "ungrouped", title: "未分组", group: undefined, count: ungrouped.length, data: collapsed.ungrouped ? [] : ungrouped });
    function move(plugin: Plugin) {
        showPanel("SimpleSelect", {
            header: "移动到分组 · " + plugin.name,
            candidates: [{ value: "", title: "未分组" }, ...groups.map(group => ({ value: group.id, title: group.name }))],
            onPress(item) {
                PluginManager.movePluginToGroup(plugin, item.value || null);
            },
        });
    }
    function options(group: PluginGroup) {
        showPanel("SimpleSelect", {
            header: group.name,
            candidates: [{ value: "rename", title: "重命名分组" }, { value: "delete", title: "删除分组" }],
            onPress(item) {
                if (item.value === "rename") editPluginGroup(group);
                else showDialog("SimpleDialog", {
                    title: "删除分组",
                    content: "删除后插件会移至未分组，不会卸载插件。",
                    onOk() {
                        PluginManager.deletePluginGroup(group.id);
                    },
                });
            },
        });
    }
    return <SectionList
        sections={sections}
        stickySectionHeadersEnabled={false}
        keyExtractor={plugin => plugin.hash}
        ListEmptyComponent={Empty}
        ListHeaderComponent={<TouchableOpacity accessibilityRole="button" accessibilityLabel="新建插件分组"
            style={styles.header} onPress={() => editPluginGroup()}><ThemeText>＋ 新建分组</ThemeText></TouchableOpacity>}
        ListFooterComponent={<View style={{ height: rpx(200) }} />}
        renderSectionHeader={({ section }) => <View style={[styles.header, { backgroundColor: colors.card }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={section.title + "分组，" + section.count + "个资源"}
                style={styles.title} onPress={() => setCollapsed(value => ({ ...value, [section.key]: !value[section.key] }))}>
                <ThemeText fontWeight="bold">{collapsed[section.key] ? "+ " : "− "}{section.title}</ThemeText>
                <ThemeText fontSize="subTitle" fontColor="textSecondary">{section.count} 个资源</ThemeText>
            </TouchableOpacity>
            {section.group ? <>
                <ThemeSwitch accessibilityLabel={section.title + "分组开关"} value={section.group.enabled}
                    onValueChange={enabled => PluginManager.setPluginGroupEnabled(section.group!.id, enabled)} />
                <IconButton name="ellipsis-vertical" accessibilityLabel={section.title + "分组选项"} onPress={() => options(section.group!)} />
            </> : null}
        </View>}
        renderItem={({ item, section }) => <PluginItem plugin={item} groupEnabled={section.group?.enabled} onMoveGroup={() => move(item)} />}
    />;
}

const styles = StyleSheet.create({
    header: { marginHorizontal: rpx(24), marginTop: rpx(24), padding: rpx(16), borderRadius: rpx(8), flexDirection: "row", alignItems: "center", gap: rpx(16) },
    title: { flex: 1, flexDirection: "row", alignItems: "center", gap: rpx(16), paddingVertical: rpx(8) },
});
