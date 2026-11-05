const React = require('react');
const renderer = require('react-test-renderer');
let mockGroups;
let mockAssignments;
const mockManager = {
    getPluginGroups: () => mockGroups,
    getPluginGroup: plugin => mockGroups.find(group => group.id === mockAssignments[plugin.name]),
    setPluginGroupEnabled: jest.fn((id, enabled) => {mockGroups.find(group => group.id === id).enabled = enabled;}),
    movePluginToGroup: jest.fn(), createPluginGroup: jest.fn(), renamePluginGroup: jest.fn(), deletePluginGroup: jest.fn(),
};
jest.mock('@/core/pluginManager', () => ({__esModule: true, default: mockManager}));
jest.mock('react-native', () => ({
    View: 'View', TouchableOpacity: 'TouchableOpacity', StyleSheet: {create: value => value},
    SectionList: props => {
        const react = require('react');
        const sections = props.sections.map(section => {
            const rows = section.data.map(item => react.createElement('Row', {key: item.hash}, props.renderItem({item, section})));
            return react.createElement('Section', {key: section.key}, props.renderSectionHeader({section}), rows);
        });
        return react.createElement('List', {}, props.ListHeaderComponent, sections);
    },
}));
jest.mock('@/components/base/themeText', () => props => require('react').createElement('Text', props, props.children));
jest.mock('@/components/base/switch', () => 'Switch');
jest.mock('@/components/base/iconButton', () => 'IconButton');
jest.mock('@/components/base/empty', () => 'Empty');
jest.mock('../pluginItem', () => 'PluginItem');
jest.mock('@/components/panels/usePanel', () => ({showPanel: jest.fn()}));
jest.mock('@/components/dialogs/useDialog', () => ({showDialog: jest.fn()}));
jest.mock('@/utils/toast', () => ({warn: jest.fn()}));
jest.mock('@/hooks/useColors', () => () => ({card: '#fff'}));
jest.mock('@/utils/rpx', () => value => value);
const PluginGroups = require('../pluginGroups').default;
const {showPanel} = require('@/components/panels/usePanel');
const {showDialog} = require('@/components/dialogs/useDialog');
let tree;
const plugins = [{name: '墨澜-wy', hash: 'wy'}, {name: '星海wy', hash: 'legacy'}];
beforeEach(() => {
    jest.clearAllMocks();
    mockGroups = [{id: 'molan', name: '墨澜', enabled: true}];
    mockAssignments = {'墨澜-wy': 'molan'};
    renderer.act(() => {tree = renderer.create(React.createElement(PluginGroups, {plugins}));});
});
afterEach(() => renderer.act(() => tree.unmount()));
it('shows grouped and ungrouped resources and routes the group switch independently', () => {
    expect(tree.root.findAllByType('PluginItem')).toHaveLength(0);
    renderer.act(() => tree.root.findByType('Switch').props.onValueChange(false));
    expect(mockManager.setPluginGroupEnabled).toHaveBeenCalledWith('molan', false);
    renderer.act(() => tree.root.findByProps({accessibilityLabel: '墨澜分组，1个资源'}).props.onPress());
    renderer.act(() => tree.update(React.createElement(PluginGroups, {plugins: [...plugins]})));
    expect(tree.root.findAllByType('PluginItem')).toHaveLength(1);
    expect(tree.root.findAllByType('PluginItem')[0].props.groupEnabled).toBe(false);
});
it('collapses the resource rows without disabling the group', () => {
    const header = () => tree.root.findByProps({accessibilityLabel: '墨澜分组，1个资源'});
    renderer.act(() => header().props.onPress());
    expect(tree.root.findAllByType('PluginItem').map(item => item.props.plugin.name)).toEqual(['墨澜-wy']);
    expect(mockManager.setPluginGroupEnabled).not.toHaveBeenCalled();
    renderer.act(() => header().props.onPress());
    expect(tree.root.findAllByType('PluginItem').map(item => item.props.plugin.name)).toEqual([]);
});
it('creates groups and allows moving a legacy single resource to a group or ungrouped', () => {
    renderer.act(() => tree.root.findByProps({accessibilityLabel: '新建插件分组'}).props.onPress());
    const close = jest.fn();
    showPanel.mock.calls.at(-1)[1].onOk('常用', close);
    expect(mockManager.createPluginGroup).toHaveBeenCalledWith('常用'); expect(close).toHaveBeenCalled();
    renderer.act(() => tree.root.findByProps({accessibilityLabel: '未分组分组，1个资源'}).props.onPress());
    renderer.act(() => tree.root.findAllByType('PluginItem')[0].props.onMoveGroup());
    const panel = showPanel.mock.calls.at(-1)[1];
    expect(panel.candidates.map(item => item.title)).toEqual(['未分组', '墨澜']);
    panel.onPress({value: 'molan'}); panel.onPress({value: ''});
    expect(mockManager.movePluginToGroup).toHaveBeenCalledWith(plugins[1], 'molan');
    expect(mockManager.movePluginToGroup).toHaveBeenCalledWith(plugins[1], null);
});
it('offers rename and group deletion without uninstalling its resources', () => {
    renderer.act(() => tree.root.findByProps({accessibilityLabel: '墨澜分组选项'}).props.onPress());
    const menu = showPanel.mock.calls.at(-1)[1];
    menu.onPress({value: 'rename'});
    expect(showPanel.mock.calls.at(-1)[1].initialValue).toBe('墨澜');
    menu.onPress({value: 'delete'});
    showDialog.mock.calls.at(-1)[1].onOk();
    expect(mockManager.deletePluginGroup).toHaveBeenCalledWith('molan');
});
