export interface PluginGroup {
    id: string;
    name: string;
    enabled: boolean;
    bundleId?: string;
}

export interface PluginGroupState {
    groups: PluginGroup[];
    /** null explicitly keeps a resource ungrouped, including after updates. */
    assignments: Record<string, string | null>;
}

export function readGroupState(value: any): PluginGroupState {
    if (!value || !Array.isArray(value.groups)) return { groups: [], assignments: {} };
    const groups: PluginGroup[] = value.groups.filter((group: PluginGroup) =>
        group && typeof group.id === "string" && typeof group.name === "string",
    ).map((group: PluginGroup) => ({ ...group, enabled: group.enabled !== false }));
    return { groups, assignments: value.assignments && typeof value.assignments === "object" ? { ...value.assignments } : {} };
}

export function registerBundleGroup(state: PluginGroupState, bundleId: string, name: string, platforms: string[], restoreMissing = false): PluginGroupState {
    const next = readGroupState(state);
    let group = next.groups.find(item => item.bundleId === bundleId);
    // Only an explicit reimport restores ungrouped resources after the auto group was deleted.
    const restoreUngrouped = restoreMissing && !group && platforms.some(platform => next.assignments[platform] === null);
    if (!group) {
        if (!restoreUngrouped && platforms.every(platform => Object.prototype.hasOwnProperty.call(next.assignments, platform))) return next;
        group = next.groups.find(item => !item.bundleId && item.name === name);
        if (group) group.bundleId = bundleId;
    }
    if (!group) {
        group = { id: "bundle:" + bundleId, name, enabled: true, bundleId };
        // A user may have already created a group with this ID.
        while (next.groups.some(item => item.id === group!.id)) group.id += "_";
        next.groups.push(group);
    }
    platforms.forEach(platform => {
        if (!Object.prototype.hasOwnProperty.call(next.assignments, platform) || (restoreUngrouped && next.assignments[platform] === null)) next.assignments[platform] = group!.id;
    });
    return next;
}

export function groupForPlugin(state: PluginGroupState, platform: string) {
    return state.groups.find(group => group.id === state.assignments[platform]);
}

export function groupAllowsPlugin(state: PluginGroupState, platform: string) {
    return groupForPlugin(state, platform)?.enabled !== false;
}
