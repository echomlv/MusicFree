const React = require('react');
const renderer = require('react-test-renderer');

const mockKeyboardListeners = new Map();
let mockWindow = {width: 393, height: 852};
let mockOrientation = "vertical";
jest.mock('react-native', () => ({
    View: 'View', Pressable: 'Pressable', KeyboardAvoidingView: 'KeyboardAvoidingView',
    StyleSheet: {create: styles => styles, hairlineWidth: 1, absoluteFillObject: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}},
    useWindowDimensions: () => mockWindow,
    Platform: {OS: 'ios'},
    Keyboard: {
        isVisible: () => false,
        dismiss: jest.fn(),
        addListener: (event, listener) => {
            mockKeyboardListeners.set(event, listener);
            return {remove: () => mockKeyboardListeners.delete(event)};
        },
    },
    BackHandler: {addEventListener: () => ({remove: jest.fn()})},
    DeviceEventEmitter: {addListener: () => ({remove: jest.fn()})},
}));
jest.mock('react-native-reanimated', () => ({
    __esModule: true,
    default: {View: 'AnimatedView'},
    Easing: {out: fn => fn, exp: jest.fn()},
    useSharedValue: value => require('react').useRef({value}).current,
    useAnimatedStyle: fn => fn(),
    useAnimatedReaction: jest.fn(),
    withTiming: value => value,
    runOnJS: fn => fn,
}));
jest.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 47, bottom: 34, left: 0, right: 0})}));
jest.mock('react-native-gesture-handler', () => ({FlatList: 'FlatList', ScrollView: 'ScrollView', TextInput: 'TextInput'}));
jest.mock('@/hooks/useColors', () => () => ({backdrop: '#f0f0f0'}));
jest.mock('@/hooks/useOrientation', () => () => mockOrientation);
jest.mock('@/utils/rpx', () => ({__esModule: true, default: n => n / 2, vh: n => 852 * n / 100, vmax: n => 852 * n / 100}));
jest.mock('@/components/panels/usePanel', () => ({panelInfoStore: {setValue: jest.fn()}, hidePanel: jest.fn()}));
jest.mock('@/components/base/fastImage', () => 'FastImage');
jest.mock('@/components/base/themeText', () => 'ThemeText');
jest.mock('@/components/base/divider', () => 'Divider');
jest.mock('@/components/base/listItem', () => {
    const component = props => require('react').createElement('ListItem', props, props.children);
    component.Content = 'ItemContent';
    component.ListItemIcon = 'ItemIcon';
    return {__esModule: true, default: component};
});
jest.mock('@/constants/assetsConst', () => ({ImgAsset: {albumDefault: 1}}));
jest.mock('@/core/i18n', () => ({useI18N: () => ({t: key => key})}));
jest.mock('../base/panelHeader', () => 'PanelHeader');

const PanelBase = require('../base/panelBase').default;
const MusicOptionsPanel = require('../base/musicOptionsPanel').default;
const SimpleInput = require('../types/simpleInput').default;
const PlayRate = require('../types/playRate').default;
let tree;
const mount = element => renderer.act(() => { tree = renderer.create(element); });
const panelStyle = () => Object.assign({}, ...tree.root.findByProps({testID: 'bottom-panel'}).props.style);

beforeEach(() => {
    jest.useFakeTimers();
    mockWindow = {width: 393, height: 852};
    mockOrientation = "vertical";
});
afterEach(() => {
    renderer.act(() => tree?.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
});

it('keeps a non-input sheet and its safe area within one full-screen bottom-aligned surface', () => {
    mount(React.createElement(PanelBase, {height: 300, keyboardAvoidBehavior: 'none', renderBody: () => React.createElement('Body')}));
    const overlay = tree.root.findByProps({testID: 'bottom-panel-overlay'});
    expect(overlay.props.style).toMatchObject({top: 0, left: 0, right: 0, bottom: 0});
    const container = tree.root.findByProps({testID: 'bottom-panel-container'});
    expect(tree.root.findAllByType('KeyboardAvoidingView')).toHaveLength(0);
    expect(Object.assign({}, ...container.props.style)).toMatchObject({justifyContent: 'flex-end', alignItems: 'center'});
    expect(panelStyle()).toMatchObject({height: 334, paddingBottom: 34});
    expect(panelStyle().bottom).toBeUndefined();
    // Paint the entire surface separately from iOS's asymmetric corner clipping.
    expect(panelStyle().backgroundColor).toBeUndefined();
    expect(panelStyle().overflow).toBe('hidden');
    const surface = tree.root.findByProps({testID: 'bottom-panel-surface'});
    expect(Object.assign({}, ...surface.props.style)).toMatchObject({
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#f0f0f0',
    });
    expect(surface.props.pointerEvents).toBe('none');
    expect(tree.root.findAllByType('Body')).toHaveLength(1);
});

it('shrinks input sheets above the keyboard and restores safe-area space after dismissal', () => {
    mount(React.createElement(PanelBase, {height: 300, renderBody: () => React.createElement('InputBody')}));
    renderer.act(() => {
        mockKeyboardListeners.get('keyboardWillShow')();
        tree.root.findByProps({testID: 'bottom-panel-container'}).props.onLayout({nativeEvent: {layout: {height: 260}}});
    });
    expect(panelStyle()).toMatchObject({height: 213, paddingBottom: 0});
    expect(tree.root.findAllByType('InputBody')).toHaveLength(1);
    renderer.act(() => {
        mockKeyboardListeners.get('keyboardWillHide')();
        tree.root.findByProps({testID: 'bottom-panel-container'}).props.onLayout({nativeEvent: {layout: {height: 852}}});
    });
    expect(panelStyle()).toMatchObject({height: 334, paddingBottom: 34});
});

it('excludes hidden source-specific actions before allocating song-menu rows', () => {
    const options = [
        {title: 'ID', icon: 'identification'},
        {title: 'Album', icon: 'album-outline', show: false},
        {title: 'Upload lyrics', icon: 'arrow-up-tray'},
    ];
    mount(React.createElement(MusicOptionsPanel, {musicItem: {title: 'Song', artist: 'Artist'}, options}));
    const list = tree.root.findByType('FlatList');
    expect(list.props.data.map(option => option.title)).toEqual(['ID', 'Upload lyrics']);
    expect(list.props.getItemLayout(null, 1)).toEqual({index: 1, length: 42, offset: 48});
});

it('uses a compact input without an empty hints scroller while preserving submission', async () => {
    const onOk = jest.fn();
    mount(React.createElement(SimpleInput, {onOk, initialValue: 'https://example.test/plugin.js'}));
    expect(tree.root.findAllByType('ScrollView')).toHaveLength(0);
    expect(panelStyle().height).toBe(164);
    await renderer.act(async () => { await tree.root.findByType('PanelHeader').props.onOk(); });
    expect(onOk).toHaveBeenCalledWith('https://example.test/plugin.js', expect.any(Function));
});

it('keeps all seven playback speeds available, including the last option', () => {
    const onRatePress = jest.fn();
    mount(React.createElement(PlayRate, {onRatePress}));
    const rows = tree.root.findAllByType('Pressable').filter(node => node.findAllByType('ThemeText').length);
    expect(rows).toHaveLength(7);
    renderer.act(() => rows[6].props.onPress());
    expect(onRatePress).toHaveBeenCalledWith(200);
});

it.each([
    [744, 1133, 744], // iPad mini portrait
    [1032, 1376, 750], // iPad Pro 13 portrait
    [1133, 744, 744],
    [1376, 1032, 750],
    [375, 1032, 375], // Split View
])('fits a %s × %s window and keeps the sheet within safe bounds', (width, height, expectedWidth) => {
    mockWindow = {width, height};
    mockOrientation = width < height ? 'vertical' : 'horizontal';
    mount(React.createElement(PanelBase, {height: 400, renderBody: () => React.createElement('Body')}));
    expect(panelStyle().width).toBe(expectedWidth);
    expect(panelStyle().height).toBeLessThanOrEqual(height - 47);
});

it('resizes an open panel on rotation, Split View and keyboard changes', () => {
    mockWindow = {width: 1032, height: 1376};
    const element = () => React.createElement(PanelBase, {height: 900, renderBody: () => React.createElement('Body')});
    mount(element());
    expect(panelStyle().width).toBe(750);
    renderer.act(() => {
        mockWindow = {width: 375, height: 1032};
        tree.update(element());
        mockKeyboardListeners.get('keyboardWillShow')();
        tree.root.findByProps({testID: 'bottom-panel-container'}).props.onLayout({nativeEvent: {layout: {height: 500}}});
    });
    expect(panelStyle()).toMatchObject({width: 375, height: 453, paddingBottom: 0});
    renderer.act(() => {
        mockWindow = {width: 1376, height: 1032};
        mockOrientation = 'horizontal';
        tree.update(element());
        mockKeyboardListeners.get('keyboardWillHide')();
        tree.root.findByProps({testID: 'bottom-panel-container'}).props.onLayout({nativeEvent: {layout: {height: 1032}}});
    });
    expect(panelStyle()).toMatchObject({width: 750, height: 985, paddingBottom: 34});
});

it('recalculates percentage height when a portrait window resizes without rotating', () => {
    mockWindow = {width: 744, height: 1133};
    const element = () => React.createElement(PanelBase, {height: '80%', renderBody: () => React.createElement('Body')});
    mount(element());
    expect(panelStyle().height).toBeCloseTo(1133 * 0.8 + 34);
    renderer.act(() => {
        mockWindow = {width: 600, height: 900};
        tree.update(element());
        tree.root.findByProps({testID: 'bottom-panel-container'}).props.onLayout({nativeEvent: {layout: {height: 900}}});
    });
    expect(panelStyle().height).toBeCloseTo(900 * 0.8 + 34);
});
