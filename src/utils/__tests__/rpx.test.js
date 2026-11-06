let mockWindow = {width: 375, height: 1032};
const mockScreen = {width: 1032, height: 1376};
jest.mock('react-native', () => ({
    Dimensions: {get: name => name === 'screen' ? mockScreen : mockWindow},
}));
const {default: rpx, vh, vw, vmin, vmax} = require('../rpx');

it('keeps controls at the same scale when launched in Split View and then expanded', () => {
    const initialSize = rpx(100);
    expect(initialSize).toBeCloseTo(100 * 440 / 750);
    mockWindow = {width: 1376, height: 1032};
    expect(rpx(100)).toBe(initialSize);
});

it('reads viewport units from the current window on every call', () => {
    mockWindow = {width: 744, height: 1133};
    expect(vw(100)).toBe(744);
    expect(vh(100)).toBe(1133);
    mockWindow = {width: 600, height: 900};
    expect(vw(100)).toBe(600);
    expect(vh(100)).toBe(900);
    expect(vmin(100)).toBe(600);
    expect(vmax(100)).toBe(900);
});
