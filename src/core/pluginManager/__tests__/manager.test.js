const mockFiles = new Map();
const mockStores = new Map();
let mockSequence = 0;
jest.mock('nanoid', () => ({nanoid: () => 'fixture-' + (++mockSequence)}));
jest.mock('@/constants/pathConst', () => ({__esModule: true, default: {pluginPath: '/plugins/'}}));
jest.mock('@/constants/commonConst', () => ({emptyFunction: () => {}, localPluginPlatform: 'local', localPluginHash: 'local', CacheControl: {NoCache: 'no-cache', NoStore: 'no-store'}, internalSerializeKey: '__meta'}));
jest.mock('@/native/mp3Util', () => ({}));
jest.mock('@/utils/log', () => ({errorLog: jest.fn(), trace: jest.fn(), devLog: jest.fn()}));
jest.mock('@/utils/storage', () => ({getStorage: async () => null, removeStorage: jest.fn()}));
jest.mock('@/core/i18n', () => ({__esModule: true, default: {t: value => value}}));
jest.mock('@/utils/delay', () => () => new Promise(() => {}));
jest.mock('@/utils/network', () => ({__esModule: true, default: {isOffline: false}}));
jest.mock('@/core/mediaCache', () => ({}));
jest.mock('@/utils/mediaExtra', () => ({removeAllMediaExtra: jest.fn(), getMediaExtraProperty: jest.fn(), patchMediaExtra: jest.fn()}));
jest.mock('@/utils/mediaUtils', () => ({resetMediaItem: (item, platform) => Object.assign(item, platform ? {platform} : {}), getLocalPath: jest.fn(), isSameMediaItem: jest.fn()}));
jest.mock('react-native-device-info', () => ({getVersion: () => '0.6.2'}));
jest.mock('react-native-url-polyfill', () => ({URL: require('url').URL}));
jest.mock('cheerio', () => ({load: jest.fn()}));
jest.mock('webdav', () => ({}));
jest.mock('axios', () => ({defaults: {}, interceptors: {response: {use: jest.fn()}}, get: jest.fn(), request: jest.fn()}));
jest.mock('@/utils/getOrCreateMMKV', () => id => {
    if (!mockStores.has(id)) mockStores.set(id, new Map());
    const data = mockStores.get(id);
    return {getString: key => data.get(key), getNumber: key => data.get(key), set: (key, value) => data.set(key, value),
        delete: key => data.delete(key), contains: key => data.has(key), getAllKeys: () => [...data.keys()]};
});
jest.mock('react-native-fs', () => ({
    readFile: jest.fn(async path => {if (!mockFiles.has(path)) throw Error('missing file'); return mockFiles.get(path);}),
    writeFile: jest.fn(async (path, content) => mockFiles.set(path, content)),
    unlink: jest.fn(async path => {if (!mockFiles.delete(path)) throw Error('missing file');}),
    readDir: jest.fn(async prefix => [...mockFiles.keys()].filter(path => path.startsWith(prefix)).map(path => ({path, name: path.split('/').pop(), isFile: () => true}))),
    exists: jest.fn(async path => mockFiles.has(path)),
}));
jest.mock('expo-file-system', () => ({readAsStringAsync: async path => mockFiles.get(path)}));
const bundle = (version = '1.0.0', names = ['墨澜-wy', '墨澜-kg']) => `module.exports={id:'molan',name:'墨澜',version:'${version}',srcUrl:'https://example.test/molan.js',plugins:${JSON.stringify(names)}.map(function(name){var scoped=env.forPlugin(name);return {platform:name,search:function(){return Promise.resolve({data:[{id:'101',title:scoped.userVariables.key||name}],isEnd:true});}};})};`;
const single = `module.exports={platform:'星海wy',version:'1.0.0',search:function(){return Promise.resolve({data:[],isEnd:true});}};`;
function manager(lazy = false) {
    const value = require('../index').default;
    value.injectDependencies({getConfig: () => lazy});
    return value;
}
async function install(value, code, config) {mockFiles.set('/incoming.js', code); return value.installPluginFromLocalFile('/incoming.js', config);}
beforeEach(() => {jest.resetModules(); mockFiles.clear(); mockStores.clear(); mockStores.set('plugin-meta', new Map([['$version', 1]])); mockSequence = 0;});

it('imports one file as separate resources, and keeps legacy single exports working', async () => {
    const value = manager();
    expect(await install(value, bundle())).toEqual(expect.objectContaining({success: true}));
    expect((await install(value, single)).success).toBe(true);
    const plugins = value.getSortedPlugins();
    expect(plugins.map(item => item.name).sort()).toEqual(['墨澜-kg', '墨澜-wy', '星海wy'].sort());
    expect(new Set(plugins.map(item => item.hash)).size).toBe(3);
    const children = plugins.filter(item => item.bundleId === 'molan');
    expect(new Set(children.map(item => item.path)).size).toBe(1);
    expect(value.getPluginGroups()).toEqual([expect.objectContaining({name: '墨澜', enabled: true})]);
    expect(value.getPluginGroup(value.getByName('星海wy'))).toBeUndefined();
    expect(value.getByMedia({platform: '墨澜-wy', id: '101'}).name).toBe('墨澜-wy');
});
it('rejects an invalid or duplicate child atomically without touching an installed file', async () => {
    const value = manager();
    await install(value, single);
    const before = value.getSortedPlugins();
    expect((await install(value, bundle('1.0.0', ['same', 'same']))).success).toBe(false);
    expect((await install(value, `module.exports={id:'bad',name:'bad',plugins:[{platform:'ok'},{platform:'bad',appVersion:'>=99.0.0'}]};`)).success).toBe(false);
    expect(value.getSortedPlugins()).toEqual(before);
    expect([...mockFiles.keys()].filter(path => path.startsWith('/plugins/'))).toHaveLength(1);
});
it('does not remove the old bundle or change groups when writing its update fails', async () => {
    const value = manager(); await install(value, bundle());
    const old = value.getSortedPlugins();
    require('react-native-fs').writeFile.mockRejectedValueOnce(Error('disk full'));
    expect((await install(value, bundle('2.0.0'))).success).toBe(false);
    expect(value.getSortedPlugins()).toEqual(old);
    expect(mockFiles.has(old[0].path)).toBe(true);
});
it('keeps independent variables, manual grouping and individual switches across update and restart', async () => {
    let value = manager(); await install(value, bundle()); await install(value, single);
    const wy = value.getByName('墨澜-wy'); const kg = value.getByName('墨澜-kg');
    value.setUserVariables(wy, {key: 'wy-key'}); value.setUserVariables(kg, {key: 'kg-key'});
    const group = value.createPluginGroup('常用');
    value.movePluginToGroup(wy, group.id); value.movePluginToGroup(value.getByName('星海wy'), group.id);
    value.setPluginEnabled(wy, false); value.setPluginGroupEnabled(group.id, false);
    expect(value.isPluginEnabled(value.getByName('星海wy'))).toBe(false);
    expect(value.getSearchablePlugins().map(item => item.name)).toEqual(['墨澜-kg']);
    value.setPluginGroupEnabled(group.id, true);
    expect(value.isPluginEnabled(wy)).toBe(false);
    expect(value.isPluginEnabled(value.getByName('星海wy'))).toBe(true);
    expect((await install(value, bundle('2.0.0'))).success).toBe(true);
    jest.resetModules(); value = manager(true); await value.setup();
    const restored = value.getByName('墨澜-wy'); await restored.ensureMounted();
    const restoredKg = value.getByName('墨澜-kg'); await restoredKg.ensureMounted();
    expect(value.getPluginGroup(restored).id).toBe(group.id);
    expect(value.isPluginEnabled(restored)).toBe(false);
    expect((await restored.instance.search()).data[0].title).toBe('wy-key');
    expect((await restoredKg.instance.search()).data[0].title).toBe('kg-key');
});
it('removes only one resource from a shared file and preserves the choice on update and restart', async () => {
    let value = manager(); await install(value, bundle());
    const wy = value.getByName('墨澜-wy'); const path = wy.path;
    await value.uninstallPlugin(wy.hash);
    expect(mockFiles.has(path)).toBe(true);
    expect(value.getByName('墨澜-kg')).toBeDefined();
    await install(value, bundle('2.0.0'), {restoreRemoved: false});
    jest.resetModules(); value = manager(true); await value.setup();
    expect(value.getByName('墨澜-wy')).toBeUndefined();
    expect(value.getByName('墨澜-kg')).toBeDefined();
    await install(value, bundle('2.0.0'));
    expect(value.getByName('墨澜-wy')).toBeDefined();
    const resources = [...value.getSortedPlugins()];
    await value.uninstallPlugin(resources[0].hash); await value.uninstallPlugin(resources[1].hash);
    expect([...mockFiles.keys()].filter(file => file.startsWith('/plugins/'))).toEqual([]);
});
it('keeps an explicitly deleted auto group deleted on restart', async () => {
    let value = manager(); await install(value, bundle());
    value.deletePluginGroup(value.getPluginGroups()[0].id);
    jest.resetModules(); value = manager(); await value.setup();
    expect(value.getPluginGroups()).toEqual([]);
    expect(value.getPluginGroup(value.getByName('墨澜-wy'))).toBeUndefined();
});
it('persists a disabled renamed group without overwriting the individual resource switches', async () => {
    let value = manager(); await install(value, bundle());
    const group = value.getPluginGroups()[0];
    value.renamePluginGroup(group.id, '我的墨澜');
    value.setPluginEnabled(value.getByName('墨澜-kg'), false);
    value.setPluginGroupEnabled(group.id, false);
    jest.resetModules(); value = manager(true); await value.setup();
    expect(value.getPluginGroups()[0]).toMatchObject({name: '我的墨澜', enabled: false});
    expect(value.getEnabledPlugins()).toEqual([]);
    value.setPluginGroupEnabled(group.id, true);
    expect(value.getEnabledPlugins().map(item => item.name)).toEqual(['墨澜-wy']);
});
it('serializes concurrent imports and invalidates a stale legacy cache after file replacement', async () => {
    const value = manager(); await Promise.all([install(value, bundle()), install(value, bundle())]);
    expect(value.getSortedPlugins()).toHaveLength(2);
    expect([...mockFiles.keys()].filter(path => path.startsWith('/plugins/'))).toHaveLength(1);
    const path = value.getSortedPlugins()[0].path;
    mockFiles.set(path, single); await manager(true).setup();
    expect(value.getSortedPlugins().map(item => item.name)).toEqual(['星海wy']);
});
it('executes legacy top-level code only once and removes shared files once during uninstall all', async () => {
    const value = manager();
    global.__legacyLoads = 0;
    await install(value, `global.__legacyLoads++;${single}`);
    expect(global.__legacyLoads).toBe(1);
    await install(value, bundle());
    require('react-native-fs').unlink.mockClear();
    await value.uninstallAllPlugins();
    expect(require('react-native-fs').unlink).toHaveBeenCalledTimes(2);
    expect(value.getSortedPlugins()).toEqual([]);
    delete global.__legacyLoads;
});
(process.env.MUSICFREE_SOURCE_ROOT ? it : it.skip)('loads all five original xinghai single-file plugins without rewriting them', async () => {
    const fs = require('fs'); const path = require('path'); const value = manager();
    const folder = path.join(process.env.MUSICFREE_SOURCE_ROOT, 'xinghai');
    for (const file of fs.readdirSync(folder).filter(name => name.endsWith('.js'))) {
        expect((await install(value, fs.readFileSync(path.join(folder, file), 'utf8'))).success).toBe(true);
    }
    expect(value.getSortedPlugins()).toHaveLength(5);
    expect(value.getPluginGroups()).toEqual([]);
});
