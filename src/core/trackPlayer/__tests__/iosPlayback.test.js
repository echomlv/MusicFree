jest.mock('react-native-reanimated', () => ({Easing: {out: value => value, exp: () => 0}}));
jest.mock('@/components/dialogs/useDialog', () => ({getCurrentDialog: jest.fn(), showDialog: jest.fn()}));
jest.mock('@/utils/log', () => ({errorLog: jest.fn(), trace: jest.fn()}));
jest.mock('@/utils/persistStatus', () => ({get: jest.fn(), set: jest.fn()}));
jest.mock('@/utils/network', () => ({isCellular: false}));
jest.mock('@/utils/delay', () => () => Promise.resolve());
jest.mock('@/core/localMusicSheet', () => ({isLocalMusic: () => false}));
jest.mock('@/constants/assetsConst', () => ({ImgAsset: {albumDefault: 'default.png'}}));
jest.mock('@/utils/fileUtils', () => ({resolveImportedAssetOrPath: value => value}));
jest.mock('@/utils/mediaUtils', () => ({
    getLocalPath: () => undefined,
    isSameMediaItem: (left, right) => left?.id === right?.id && left?.platform === right?.platform,
}));
jest.mock('react-native-track-player', () => ({
    Event: {PlaybackQueueEnded: 'queue-ended', PlaybackError: 'error'},
    State: {Ended: 'ended', Playing: 'playing', Stopped: 'stopped', None: 'none'},
    addEventListener: jest.fn(),
    getActiveTrack: jest.fn(),
    getPlaybackState: jest.fn(),
    setQueue: jest.fn(), reset: jest.fn(), play: jest.fn(), setRate: jest.fn(),
}));

const nativePlayer = require('react-native-track-player');
const player = require('../index').default;
const {MusicRepeatMode} = require('@/constants/repeatModeConst');
const {getDefaultStore} = require('jotai');
const {deadlineAtom, closeAfterPlayEndAtom} = require('@/utils/sleepTimerState');
const song = {id: 'one', platform: 'test', title: 'One', url: 'https://example.com/one.mp3'};
let onQueueEnded;

beforeAll(async () => {
    player.injectDependencies({getConfig: () => undefined}, {}, {});
    await player.setupTrackPlayer();
    onQueueEnded = nativePlayer.addEventListener.mock.calls.find(([event]) => event === 'queue-ended')[1];
});

beforeEach(() => {
    jest.restoreAllMocks();
    nativePlayer.getActiveTrack.mockResolvedValue(song);
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'ended'});
    player.setCurrentMusic(song);
    player.setRepeatMode(MusicRepeatMode.QUEUE);
    getDefaultStore().set(deadlineAtom, null);
    getDefaultStore().set(closeAfterPlayEndAtom, false);
    jest.spyOn(player, 'skipToNext').mockResolvedValue(undefined);
    jest.spyOn(player, 'play').mockResolvedValue(undefined);
    nativePlayer.reset.mockClear();
    nativePlayer.setQueue.mockClear();
});

it('advances exactly once when duplicate end events arrive together', async () => {
    await Promise.all([onQueueEnded(), onQueueEnded()]);
    expect(player.skipToNext).toHaveBeenCalledTimes(1);
});

it('replays the current song in single-repeat mode', async () => {
    player.setRepeatMode(MusicRepeatMode.SINGLE);
    await onQueueEnded();
    expect(player.play).toHaveBeenCalledWith(null, true);
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('stops before advancing when a finish-current-song timer has expired', async () => {
    getDefaultStore().set(deadlineAtom, Date.now() - 1000);
    getDefaultStore().set(closeAfterPlayEndAtom, true);
    await onQueueEnded();
    expect(nativePlayer.reset).toHaveBeenCalledTimes(1);
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('ignores a stale end event after playback has already changed', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'playing'});
    await onQueueEnded();
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('sends only the playable source to the native queue', async () => {
    await player.setTrackSource(song);
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({url: song.url})]);
});
