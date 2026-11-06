const mockValues = new Map();
const mockGetStorage = jest.fn();
jest.mock('@/utils/getOrCreateMMKV.ts', () => ({
    __esModule: true,
    default: () => ({
        contains: key => mockValues.has(key),
        getString: key => mockValues.get(key),
        set: (key, value) => mockValues.set(key, value),
        delete: key => mockValues.delete(key),
    }),
}));
jest.mock('@/utils/storage', () => ({
    getStorage: (...args) => mockGetStorage(...args),
    removeStorage: jest.fn(),
}));
jest.mock('react-native-mmkv', () => ({
    useMMKVObject: key => [mockValues.has(key) ? JSON.parse(mockValues.get(key)) : undefined],
}));
// MMKV's hook is mocked above; read the UI-facing value without mounting native storage.
const {default: config, useAppConfig: readUIConfig} = require('../appConfig');
const enabledByDefault = [
    'basic.useCelluarNetworkPlay',
    'basic.tryChangeSourceWhenPlayFail',
    'basic.autoStopWhenError',
    'lyric.autoSearchLyric',
];

beforeEach(() => {
    mockValues.clear();
    mockGetStorage.mockResolvedValue(undefined);
});

it.each(enabledByDefault)('shares the enabled default for %s and preserves explicit opt-out', key => {
    expect(config.getConfig(key)).toBe(true);
    expect(readUIConfig(key)).toBe(true);
    config.setConfig(key, false);
    expect(config.getConfig(key)).toBe(false);
    expect(readUIConfig(key)).toBe(false);
    config.setConfig(key, undefined);
    expect(config.getConfig(key)).toBe(true);
    expect(readUIConfig(key)).toBe(true);
});

it('keeps album playback as the default across first and subsequent launches', async () => {
    await config.setup();
    await config.setup();
    expect(config.getConfig('basic.clickMusicInAlbum')).toBe('playAlbum');
    expect(readUIConfig('basic.clickMusicInAlbum')).toBe('playAlbum');
    expect(config.getConfig('basic.useCelluarNetworkDownload')).toBeUndefined();
});

it.each(['playMusic', 'playAlbum'])('preserves the saved album action %s during migration', async action => {
    mockValues.set('$schema', '1');
    config.setConfig('basic.clickMusicInAlbum', action);
    await config.setup();
    expect(config.getConfig('basic.clickMusicInAlbum')).toBe(action);
});

it.each([['播放歌曲', 'playMusic'], ['播放专辑', 'playAlbum']])('migrates the legacy album action %s without changing disabled switches', async (legacy, expected) => {
    mockGetStorage.mockResolvedValue({setting: {basic: {
        clickMusicInAlbum: legacy,
        useCelluarNetworkPlay: false,
        tryChangeSourceWhenPlayFail: false,
        autoStopWhenError: false,
    }, lyric: {autoSearchLyric: false}}});
    await config.setup();
    expect(config.getConfig('basic.clickMusicInAlbum')).toBe(expected);
    for (const key of enabledByDefault) {
        expect(config.getConfig(key)).toBe(false);
        expect(readUIConfig(key)).toBe(false);
    }
});
