jest.mock('@/components/base/icon.tsx', () => 'MockIcon');
jest.mock('nanoid', () => {let id = 0; return {nanoid: () => String(++id)};});
jest.mock('@/hooks/useColors', () => () => ({notification: '#fff', shadow: '#000', text: '#000'}));
jest.mock('react-native-gesture-handler', () => ({
    GestureDetector: require('react-native').View,
    Directions: {UP: 1},
    Gesture: {Fling: () => ({direction() {return this;}, onEnd() {return this;}, runOnJS() {return this;}})},
}));
jest.mock('react-native-reanimated', () => ({
    __esModule: true,
    default: {View: require('react-native').View},
    Easing: {out: value => value, exp: () => 0},
    cancelAnimation: jest.fn(),
    useSharedValue: () => ({value: 0}),
    useAnimatedStyle: () => ({}),
    withTiming: value => value,
    withDelay: (_, value) => value,
    runOnJS: fn => fn,
}));

const React = require('react');
const renderer = require('react-test-renderer');
const {Text} = require('react-native');
const {ToastBaseComponent, showToast, dismissToast} = require('../toast');
let tree;
const text = () => tree.root.findAllByType(Text).map(node => node.props.children).join('|');
beforeEach(() => renderer.act(() => {tree = renderer.create(React.createElement(ToastBaseComponent));}));
afterEach(() => renderer.act(() => {
    dismissToast('playback-error'); dismissToast('download'); tree.unmount();
}));

it('replaces repeated playback failures instead of queueing old songs', () => {
    renderer.act(() => {showToast({key: 'playback-error', message: 'First failed', type: 'warn'});});
    renderer.act(() => {showToast({key: 'playback-error', message: 'Latest failed', type: 'warn'});});
    expect(text()).toContain('Latest failed');
    expect(text()).not.toContain('First failed');
    renderer.act(() => dismissToast('playback-error'));
    expect(text()).toBe('');
});

it('removes queued playback failures without dismissing an unrelated download message', () => {
    renderer.act(() => {showToast({key: 'download', message: 'Downloaded', type: 'success'});});
    renderer.act(() => {
        showToast({key: 'playback-error', message: 'First failed', type: 'warn'});
        showToast({key: 'playback-error', message: 'Latest failed', type: 'warn'});
        dismissToast('playback-error');
    });
    expect(text()).toContain('Downloaded');
    renderer.act(() => dismissToast('download'));
    expect(text()).toBe('');
});
