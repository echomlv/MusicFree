jest.mock('react-native-reanimated', () => ({Easing: {out: value => value, exp: () => 0}}));
jest.mock('@/components/dialogs/useDialog', () => ({getCurrentDialog: jest.fn(), showDialog: jest.fn()}));
jest.mock('@/utils/log', () => ({errorLog: jest.fn(), trace: jest.fn()}));
jest.mock('@/components/base/toast', () => ({showToast: jest.fn(), dismissToast: jest.fn()}));
jest.mock('@/utils/iosPlaybackSource', () => ({downloadPlaybackSource: jest.fn()}));
jest.mock('@/core/i18n', () => ({t: (key, args) => `${key}: ${args.title}`}));
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
    Event: {PlaybackQueueEnded: 'queue-ended', PlaybackError: 'error', PlaybackProgressUpdated: 'progress', PlaybackState: 'state'},
    State: {Ended: 'ended', Playing: 'playing', Paused: 'paused', Ready: 'ready', Error: 'error', Stopped: 'stopped', None: 'none'},
    addEventListener: jest.fn(),
    getActiveTrack: jest.fn(),
    getPlaybackState: jest.fn(),
    getProgress: jest.fn(),
    getActiveTrackIndex: jest.fn(), getTrack: jest.fn(), updateMetadataForTrack: jest.fn(),
    setQueue: jest.fn(), reset: jest.fn(), play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(), setRate: jest.fn(),
}));

const nativePlayer = require('react-native-track-player');
const player = require('../index').default;
const {MusicRepeatMode} = require('@/constants/repeatModeConst');
const {getDefaultStore} = require('jotai');
const {deadlineAtom, closeAfterPlayEndAtom} = require('@/utils/sleepTimerState');
const {showToast} = require('@/components/base/toast');
const {downloadPlaybackSource} = require('@/utils/iosPlaybackSource');
const {trace} = require('@/utils/log');
const persist = require('@/utils/persistStatus');
const song = {id: 'one', platform: 'test', title: 'One', url: 'https://example.com/one.mp3'};
const getConfig = jest.fn();
const getMediaSource = jest.fn();
const addMusic = jest.fn();
let onQueueEnded;
let onPlaybackError;
let onProgress;

beforeAll(async () => {
    player.injectDependencies({getConfig}, {addMusic}, {
        getByName: () => ({methods: {getMediaSource}}),
        getByMedia: () => ({methods: {getMediaSource}}),
    });
    await player.setupTrackPlayer();
    onQueueEnded = nativePlayer.addEventListener.mock.calls.find(([event]) => event === 'queue-ended')[1];
    onPlaybackError = nativePlayer.addEventListener.mock.calls.find(([event]) => event === 'error')[1];
    onProgress = nativePlayer.addEventListener.mock.calls.find(([event]) => event === 'progress')[1];
});

beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    getConfig.mockReset();
    persist.get.mockReset();
    getMediaSource.mockReset().mockResolvedValue({url: 'https://example.com/fresh.mp3'});
    downloadPlaybackSource.mockImplementation(() => ({promise: Promise.reject(new Error('Unavailable file')), cancel: jest.fn()}));
    nativePlayer.getActiveTrack.mockResolvedValue(song);
    nativePlayer.getActiveTrackIndex.mockResolvedValue(0);
    nativePlayer.getTrack.mockResolvedValue(song);
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'ended'});
    nativePlayer.getProgress.mockResolvedValue({position: 100, duration: 100, buffered: 100});
    player.setCurrentMusic(song);
    player.failedPlayRequestId = -1;
    player.endedPlayRequestId = -1;
    player.fallbackRequestId = -1;
    player.fallbackDownload = undefined;
    player.playbackRequested = true;
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

it.each(['paused', 'ready'])('advances after natural completion even when iOS has already changed to %s', async state => {
    nativePlayer.getPlaybackState.mockResolvedValue({state});
    nativePlayer.getProgress.mockResolvedValue({position: 262.64, duration: 262.687, buffered: 262.687});
    await onQueueEnded({track: 0, position: 262.64});
    expect(player.skipToNext).toHaveBeenCalledTimes(1);
});

it('ignores an old end event after seeking back into the current song', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'paused'});
    nativePlayer.getProgress.mockResolvedValue({position: 10, duration: 100, buffered: 100});
    await onQueueEnded({track: 0, position: 100});
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('consumes sequential duplicate end events only once for the same play request', async () => {
    await onQueueEnded({track: 0, position: 100});
    await onQueueEnded({track: 0, position: 100});
    expect(player.skipToNext).toHaveBeenCalledTimes(1);
});

it('ignores an end event if a new play request starts while its state is being read', async () => {
    nativePlayer.getActiveTrack.mockImplementationOnce(async () => {
        player.playRequestId += 1;
        return song;
    });
    await onQueueEnded({track: 0, position: 100});
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('still honors a finish-current-song timer when iOS reports paused after completion', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'paused'});
    getDefaultStore().set(deadlineAtom, Date.now() - 1000);
    getDefaultStore().set(closeAfterPlayEndAtom, true);
    await onQueueEnded({track: 0, position: 100});
    expect(nativePlayer.reset).toHaveBeenCalledTimes(1);
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

it('advances when FLAC progress exceeds EOF without an end event', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'playing'});
    nativePlayer.getProgress.mockResolvedValue({position: 102, duration: 100});
    await onProgress({position: 102, duration: 100});
    await onQueueEnded({position: 102});
    expect(player.skipToNext).toHaveBeenCalledTimes(1);
});

it.each([
    ['playing', 99, 100], ['paused', 103, 100], ['playing', 103, 0], ['playing', 103, Infinity],
])('does not infer an end from %s at %s/%s', async (state, position, duration) => {
    nativePlayer.getPlaybackState.mockResolvedValue({state});
    nativePlayer.getProgress.mockResolvedValue({position, duration});
    await onProgress({position, duration});
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('ignores a stale overrun event after seeking away from EOF', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'playing'});
    nativePlayer.getProgress.mockResolvedValue({position: 20, duration: 100});
    await onProgress({position: 102, duration: 100});
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('honors single-repeat and finish-current timers for FLAC overruns', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'playing'});
    nativePlayer.getProgress.mockResolvedValue({position: 102, duration: 100});
    player.setRepeatMode(MusicRepeatMode.SINGLE);
    await onProgress({position: 102, duration: 100});
    expect(player.play).toHaveBeenCalledWith(null, true);
    player.endedPlayRequestId = -1;
    getDefaultStore().set(deadlineAtom, Date.now() - 1000);
    getDefaultStore().set(closeAfterPlayEndAtom, true);
    await onProgress({position: 102, duration: 100});
    expect(nativePlayer.reset).toHaveBeenCalledTimes(1);
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('retries a failed remote source from a downloaded file before skipping', async () => {
    downloadPlaybackSource.mockReturnValue({promise: Promise.resolve('file:///cache/song.m4a'), cancel: jest.fn()});
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    await onPlaybackError({error: 'Resource failed'});
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({url: 'file:///cache/song.m4a'})]);
    expect(persist.set).toHaveBeenCalledWith('music.musicItem', expect.objectContaining({url: song.url}));
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('does not download a live or local source after failure', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    nativePlayer.getActiveTrack.mockResolvedValue({...song, isLiveStream: true});
    await onPlaybackError({error: 'Stream failed'});
    expect(downloadPlaybackSource).not.toHaveBeenCalled();
});

it('cancels a pending download when the user pauses, and never restarts playback', async () => {
    let resolve;
    const cancel = jest.fn();
    downloadPlaybackSource.mockReturnValue({promise: new Promise(r => {resolve = r;}), cancel});
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    const pending = onPlaybackError({error: 'Resource failed'});
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await player.pause();
    resolve('file:///cache/late.m4a');
    await pending;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(nativePlayer.setQueue).not.toHaveBeenCalled();
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('ignores a late native error after the user has paused', async () => {
    await player.pause();
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    await onPlaybackError({error: 'Late failure'});
    expect(downloadPlaybackSource).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
});

it('sends only the playable source to the native queue', async () => {
    await player.setTrackSource(song);
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({url: song.url})]);
});

it('handles the iOS error-only payload and follows the automatic next-track setting', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({
        state: 'error', error: {code: 'ios_failed_to_load_resource', message: 'Failed to load resource'},
    });
    await onPlaybackError({error: 'SwiftAudioEx playback error'});
    expect(trace).toHaveBeenCalledWith('播放出错', {
        code: 'ios_failed_to_load_resource', message: 'Failed to load resource',
    });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({type: 'warn', message: expect.stringContaining('One')}));
    expect(player.skipToNext).toHaveBeenCalledTimes(1);
});

it('shows the failure without advancing when automatic pause is enabled', async () => {
    getConfig.mockImplementation(key => key === 'basic.autoStopWhenError');
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    await onPlaybackError({error: 'SwiftAudioEx playback error'});
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('handles duplicate native failures from one play attempt only once', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    await Promise.all([
        onPlaybackError({error: 'Resource failed'}),
        onPlaybackError({error: 'Resource failed'}),
    ]);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(player.skipToNext).toHaveBeenCalledTimes(1);
});

it('ignores stale errors once the current track is playing', async () => {
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'playing'});
    await onPlaybackError({error: 'Previous resource failed'});
    expect(showToast).not.toHaveBeenCalled();
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('does not advance after the user has retried successfully during the failure delay', async () => {
    nativePlayer.getPlaybackState.mockResolvedValueOnce({state: 'error'}).mockResolvedValue({state: 'playing'});
    await onPlaybackError({error: 'Resource failed'});
    expect(player.skipToNext).not.toHaveBeenCalled();
});

it('resolves a fresh source when pressing play after a native error', async () => {
    player.play.mockRestore();
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    await player.play();
    expect(getMediaSource).toHaveBeenCalledWith(expect.objectContaining({id: song.id}), 'standard');
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({url: 'https://example.com/fresh.mp3'})]);
    expect(nativePlayer.play).toHaveBeenCalledTimes(1);
});

it('resumes a paused track without resolving its source again', async () => {
    player.play.mockRestore();
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'paused'});
    await player.play();
    expect(getMediaSource).not.toHaveBeenCalled();
    expect(nativePlayer.play).toHaveBeenCalledTimes(1);
});

it('reports an unexpected source-resolution exception instead of silently swallowing it', async () => {
    player.play.mockRestore();
    getConfig.mockImplementation(key => key === 'basic.autoStopWhenError');
    nativePlayer.getTrack.mockResolvedValue(undefined);
    getMediaSource.mockRejectedValue(new Error('Source lookup failed'));
    await player.play();
    expect(showToast).toHaveBeenCalledTimes(1);
});

it('clears the startup-only suppression flag for an explicit play attempt', async () => {
    await player.setTrackSource({...song, isInit: true});
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({isInit: false})]);
});

it('clears the startup suppression flag when resuming an already loaded track', async () => {
    player.play.mockRestore();
    nativePlayer.getTrack.mockResolvedValue({...song, isInit: true});
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'paused'});
    await player.play();
    expect(nativePlayer.updateMetadataForTrack).toHaveBeenCalledWith(0, expect.objectContaining({isInit: false}));
});

it('does not let a late startup source replace a source resolved by an explicit play request', async () => {
    player.play.mockRestore();
    let resolveStartup;
    getMediaSource.mockReturnValueOnce(new Promise(resolve => {resolveStartup = resolve;}));
    persist.get.mockImplementation(key => key === 'music.musicItem' ? {...song} : key === 'music.playList' ? [song] : null);
    await player.setupTrackPlayer();
    nativePlayer.getPlaybackState.mockResolvedValue({state: 'error'});
    await player.play();
    resolveStartup({url: 'https://example.com/stale-startup.mp3'});
    await Promise.resolve();
    expect(nativePlayer.setQueue).toHaveBeenCalledTimes(1);
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({url: 'https://example.com/fresh.mp3'})]);
});


const flushSourcePromises = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
afterEach(() => jest.useRealTimers());

it('starts alternate-source lookup after one shared 8s budget and ignores a late original URL', async () => {
    jest.useFakeTimers();
    player.play.mockRestore();
    const original = {id: 'failover', platform: 'broken', title: '解药', artist: '暴躁默', alias: '酷狗'};
    const alternative = {...original, id: 'other', platform: 'working'};
    let finishOriginal;
    const resolveOriginal = jest.fn(() => new Promise(resolve => { finishOriginal = resolve; }));
    const resolveAlternative = jest.fn().mockResolvedValue({url: 'https://example.com/alternative.mp3'});
    const search = jest.fn().mockResolvedValue({data: [alternative]});
    player.pluginManagerService = {
        getByName: () => ({methods: {getMediaSource: resolveOriginal}}),
        getByMedia: () => ({methods: {getMediaSource: resolveAlternative}}),
        getSearchablePlugins: () => [{name: 'working', methods: {search}}],
    };
    getConfig.mockImplementation(key => key === 'basic.tryChangeSourceWhenPlayFail' ? true : undefined);
    const pending = player.play(original, true);
    await flushSourcePromises();
    expect(search).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(8000);
    await pending;
    expect(resolveOriginal).toHaveBeenCalledTimes(1);
    expect(resolveOriginal).toHaveBeenCalledWith(original, 'standard', 0);
    expect(search).toHaveBeenCalledWith('解药', 1, 'music');
    expect(resolveAlternative).toHaveBeenCalledWith(alternative, 'standard', 0);
    expect(nativePlayer.setQueue).toHaveBeenLastCalledWith([expect.objectContaining({url: 'https://example.com/alternative.mp3'})]);
    finishOriginal({url: 'https://example.com/late.mp3'});
    await flushSourcePromises();
    expect(nativePlayer.setQueue).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
});

it('continues to another search provider after a stalled request and ranks candidate titles', async () => {
    jest.useFakeTimers();
    const original = {id: 'lookup', platform: 'broken', title: '解药', artist: '暴躁默', alias: '酷狗'};
    const wrong = {id: 'wrong', platform: 'working', title: '别的歌', artist: '暴躁默'};
    const right = {id: 'right', platform: 'working', title: '解药', artist: '暴躁默'};
    const stalledSearch = jest.fn(() => new Promise(() => {}));
    const workingSearch = jest.fn().mockResolvedValue({data: [wrong, right]});
    player.pluginManagerService = {getSearchablePlugins: () => [
        {name: 'slow', methods: {search: stalledSearch}},
        {name: 'working', methods: {search: workingSearch}},
    ]};
    const pending = player.getSimilarMusic(original, 'music');
    await jest.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual(right);
    expect(workingSearch).toHaveBeenCalledWith('解药', 1, 'music');
    expect(jest.getTimerCount()).toBe(0);
});

it('does not publish a fallback when a newer play request supersedes the original', async () => {
    jest.useFakeTimers();
    player.play.mockRestore();
    const original = {id: 'superseded', platform: 'broken', title: '解药', artist: '暴躁默'};
    const search = jest.fn();
    player.pluginManagerService = {
        getByName: () => ({methods: {getMediaSource: () => new Promise(() => {})}}),
        getSearchablePlugins: () => [{name: 'working', methods: {search}}],
    };
    getConfig.mockImplementation(key => key === 'basic.tryChangeSourceWhenPlayFail' ? true : undefined);
    const pending = player.play(original, true);
    await flushSourcePromises();
    player.playRequestId++;
    await jest.advanceTimersByTimeAsync(8000);
    await pending;
    expect(search).not.toHaveBeenCalled();
    expect(nativePlayer.setQueue).not.toHaveBeenCalled();
});


it('preserves the existing quality attempts and retry defaults with automatic failover disabled', async () => {
    player.play.mockRestore();
    const original = {id: 'no-failover', platform: 'test', title: 'Song', artist: 'Artist'};
    const resolve = jest.fn().mockResolvedValueOnce(null).mockResolvedValue({url: 'https://example.com/high.mp3'});
    const search = jest.fn();
    player.pluginManagerService = {
        getByName: () => ({methods: {getMediaSource: resolve}}),
        getSearchablePlugins: search,
    };
    await player.play(original, true);
    expect(resolve.mock.calls.map(call => call.slice(1))).toEqual([['standard'], ['high']]);
    expect(search).not.toHaveBeenCalled();
});


it('repairs a restored Qishui cover before the mini player receives the current track', () => {
    const raw = 'https://p3-luna.douyinpic.com/img/ies-music/pgc_cover_3656fc2edd76a1f76f5ef87ee9818998';
    player.setCurrentMusic({...song, artwork:raw});
    expect(player.currentMusic.artwork).toBe(raw + '~tplv-b829550vbb-resize:960:960.png');
});

it('uses the repaired artwork for the native queue and persisted playback state', async () => {
    const raw = 'https://p3-luna.douyinpic.com/img/ies-music/pgc_cover_3656fc2edd76a1f76f5ef87ee9818998';
    const artwork = raw + '~tplv-b829550vbb-resize:960:960.png';
    await player.setTrackSource({...song,artwork:raw},false);
    expect(nativePlayer.setQueue).toHaveBeenCalledWith([expect.objectContaining({artwork})]);
    expect(persist.set).toHaveBeenCalledWith('music.musicItem',expect.objectContaining({artwork}));
    expect(player.mergeTrackSource(song,{artwork:raw}).artwork).toBe(artwork);
});
