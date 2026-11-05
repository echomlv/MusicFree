jest.mock('react-native-fs', () => ({
    CachesDirectoryPath: '/Caches', exists: jest.fn(), mkdir: jest.fn(),
    moveFile: jest.fn(), readDir: jest.fn(), stopDownload: jest.fn(), unlink: jest.fn(),
}));
jest.mock('../audioFile', () => ({downloadAudioFile: jest.fn()}));

const fs = require('react-native-fs');
const {downloadAudioFile} = require('../audioFile');
const {downloadPlaybackSource} = require('../iosPlaybackSource');
const flush = async () => {for (let i = 0; i < 12; i++) await Promise.resolve();};

beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue(undefined);
    fs.readDir.mockResolvedValue([]);
    fs.exists.mockResolvedValue(false);
    fs.unlink.mockResolvedValue(undefined);
    fs.moveFile.mockResolvedValue(undefined);
    downloadAudioFile.mockReturnValue({jobId: 7, promise: Promise.resolve({extension: 'm4a'})});
});
afterEach(() => jest.useRealTimers());

it('does not start a native request when cancelled before directory preparation finishes', async () => {
    let resolveDirectory;
    fs.mkdir.mockReturnValue(new Promise(resolve => {resolveDirectory = resolve;}));
    const request = downloadPlaybackSource('https://cdn.test/audio');
    request.cancel();
    resolveDirectory();
    await expect(request.promise).resolves.toBeNull();
    expect(downloadAudioFile).not.toHaveBeenCalled();
});

it('does not publish a downloaded file if native completion arrives after cancellation', async () => {
    let finishDownload;
    downloadAudioFile.mockReturnValue({jobId: 7, promise: new Promise(resolve => {finishDownload = resolve;})});
    const request = downloadPlaybackSource('https://cdn.test/audio');
    await flush();
    request.cancel();
    finishDownload({extension: 'm4a'});
    await expect(request.promise).resolves.toBeNull();
    expect(fs.stopDownload).toHaveBeenCalledWith(7);
    expect(fs.moveFile).not.toHaveBeenCalled();
});

it('bounds a stalled native download even if it never settles its promise', async () => {
    jest.useFakeTimers();
    downloadAudioFile.mockReturnValue({jobId: 7, promise: new Promise(() => {})});
    const request = downloadPlaybackSource('https://cdn.test/audio');
    const outcome = request.promise.then(value => ({value}), error => ({error}));
    await flush();
    jest.advanceTimersByTime(30000);
    expect((await outcome).error?.message).toContain('timed out');
    expect(fs.stopDownload).toHaveBeenCalledWith(7);
    expect(fs.moveFile).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});

it('keeps the detected extension when publishing a successful fallback', async () => {
    const request = downloadPlaybackSource('https://cdn.test/song.mp3');
    await expect(request.promise).resolves.toMatch(/^file:\/\/\/Caches\/TrackPlayer\/MusicFreePlayback\/.+\.m4a$/);
    expect(fs.moveFile).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/), expect.stringMatching(/\.m4a$/));
    expect(fs.stopDownload).not.toHaveBeenCalled();
});
