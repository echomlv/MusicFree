const {Buffer} = require('buffer');
jest.mock('react-native-fs', () => ({downloadFile: jest.fn(), exists: jest.fn(), read: jest.fn(), stat: jest.fn(), unlink: jest.fn()}));
const fs = require('react-native-fs');
const {downloadAudioFile, getAudioExtension} = require('../audioFile');

beforeEach(() => {
    jest.clearAllMocks();
    fs.exists.mockResolvedValue(true);
    fs.unlink.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({size: 100});
    fs.read.mockResolvedValue(Buffer.from('fLaC').toString('base64'));
    fs.downloadFile.mockImplementation(options => {
        options.begin({headers: {'Content-Type': 'audio/mpeg'}});
        return {jobId: 1, promise: Promise.resolve({statusCode: 200, bytesWritten: 100})};
    });
});

it('uses FLAC bytes instead of a misleading mp3 URL and MIME', async () => {
    await expect(downloadAudioFile({fromUrl: 'https://cdn.test/song.mp3', toFile: '/cache/audio'}).promise)
        .resolves.toMatchObject({extension: 'flac'});
});

it('reports an HTTP failure before trying to inspect or publish a missing file', async () => {
    fs.downloadFile.mockReturnValue({promise: Promise.resolve({statusCode: 403, bytesWritten: 0})});
    await expect(downloadAudioFile({fromUrl: 'https://cdn.test/audio', toFile: '/cache/audio'}).promise).rejects.toThrow('HTTP 403');
    expect(fs.read).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledWith('/cache/audio');
});

it('rejects a successful but empty response', async () => {
    fs.stat.mockResolvedValue({size: 0});
    await expect(downloadAudioFile({fromUrl: 'https://cdn.test/audio', toFile: '/cache/audio'}).promise).rejects.toThrow('empty');
});

it.each([
    ['494433', 'mp3'], ['fff15080', 'aac'], ['00000018667479704d344120', 'm4a'],
    ['524946460000000057415645', 'wav'], ['4f676753', 'ogg'],
])('recognizes %s as %s', async (hex, extension) => {
    fs.read.mockResolvedValue(Buffer.from(hex, 'hex').toString('base64'));
    await expect(getAudioExtension('/cache/audio')).resolves.toBe(extension);
});

it('rejects an HTML error page with a misleading audio URL', async () => {
    fs.read.mockResolvedValue(Buffer.from('<html>Unavailable</html>').toString('base64'));
    await expect(getAudioExtension('/cache/audio', 'text/html', 'https://cdn.test/song.mp3')).rejects.toThrow('Expected audio');
});

it('rejects an HTML error page even when the server labels it audio', async () => {
    fs.read.mockResolvedValue(Buffer.from('<html>Unavailable</html>').toString('base64'));
    await expect(getAudioExtension('/cache/audio', 'audio/mpeg')).rejects.toThrow('Expected audio');
});
