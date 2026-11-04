jest.mock('react-native-reanimated', () => ({Easing: {out: value => value, exp: () => 0}}));
jest.mock('expo-document-picker', () => ({getDocumentAsync: jest.fn()}));
jest.mock('expo-file-system', () => ({copyAsync: jest.fn()}));
jest.mock('react-native-fs', () => ({
    hash: jest.fn(), exists: jest.fn(), mkdir: jest.fn(), unlink: jest.fn(),
}));
jest.mock('@/constants/pathConst', () => ({importedMusicPath: '/Documents/imported_music'}));
jest.mock('@/core/localMusicSheet', () => ({addMusic: jest.fn()}));
jest.mock('@/core/pluginManager', () => ({getByHash: jest.fn()}));
jest.mock('@/utils/fileUtils', () => ({getFileName: name => name.split('/').pop()}));

const {getDocumentAsync} = require('expo-document-picker');
const {copyAsync} = require('expo-file-system');
const fs = require('react-native-fs');
const library = require('@/core/localMusicSheet');
const plugins = require('@/core/pluginManager');
const {importLocalMusicFiles} = require('../localMusicImport');

const importMusicItem = jest.fn();
const musicItem = {id: 'song', platform: '本地', title: 'A song'};
const destination = '/Documents/imported_music/digest/A song.mp3';

beforeEach(() => {
    jest.clearAllMocks();
    getDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{name: 'A song.mp3', uri: 'file:///Caches/A%20song.mp3'}],
    });
    fs.hash.mockResolvedValue('digest');
    fs.exists.mockResolvedValue(false);
    copyAsync.mockResolvedValue(undefined);
    importMusicItem.mockResolvedValue(musicItem);
    plugins.getByHash.mockReturnValue({instance: {importMusicItem}});
});

it('saves a durable Documents path instead of the picker cache path', async () => {
    await expect(importLocalMusicFiles()).resolves.toBe(true);
    expect(fs.hash).toHaveBeenCalledWith('/Caches/A song.mp3', 'md5');
    expect(copyAsync).toHaveBeenCalledWith({
        from: 'file:///Caches/A%20song.mp3', to: `file://${destination}`,
    });
    expect(importMusicItem).toHaveBeenCalledWith(destination);
    expect(library.addMusic).toHaveBeenCalledWith(musicItem);
});

it('does not change the library after cancelling the picker', async () => {
    getDocumentAsync.mockResolvedValue({canceled: true, assets: null});
    await expect(importLocalMusicFiles()).resolves.toBe(false);
    expect(copyAsync).not.toHaveBeenCalled();
    expect(library.addMusic).not.toHaveBeenCalled();
});

it('reuses an existing imported file', async () => {
    fs.exists.mockResolvedValue(true);
    await importLocalMusicFiles();
    expect(copyAsync).not.toHaveBeenCalled();
    expect(importMusicItem).toHaveBeenCalledWith(destination);
});

it('removes a newly copied file when adding it fails', async () => {
    importMusicItem.mockRejectedValueOnce(new Error('Metadata failed'));
    await expect(importLocalMusicFiles()).rejects.toThrow('Metadata failed');
    expect(fs.unlink).toHaveBeenCalledWith(destination);
    expect(library.addMusic).not.toHaveBeenCalled();
});

it('leaves an existing audio file intact when adding it fails', async () => {
    fs.exists.mockResolvedValue(true);
    importMusicItem.mockRejectedValueOnce(new Error('Metadata failed'));
    await expect(importLocalMusicFiles()).rejects.toThrow('Metadata failed');
    expect(fs.unlink).not.toHaveBeenCalled();
});
