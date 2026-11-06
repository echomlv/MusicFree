const {getDefaultConfig} = require('expo/metro-config');
const {mergeConfig} = require('@react-native/metro-config');

/**
 * Reference: https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md
 */
const defaultConfig = getDefaultConfig(__dirname);
const {assetExts, sourceExts} = defaultConfig.resolver;
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    transformer: {
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
    },
    resolver: {
        // Use Metro's built-in FSEvents/Node watcher; no Homebrew service needed.
        useWatchman: false,
        assetExts: assetExts.filter(ext => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        // Native dependencies, build output and local reference checkouts are not JS sources.
        blockList: [
            /[/\\]\.git(?:[/\\]|$)/,
            /[/\\]\.agents(?:[/\\]|$)/,
            /[/\\]ios[/\\](?:Pods|build)(?:[/\\]|$)/,
            /[/\\]android[/\\](?:\.gradle|build|app[/\\](?:build|\.cxx))(?:[/\\]|$)/,
            /[/\\]vendor[/\\]bundle(?:[/\\]|$)/,
        ],
    },
};

module.exports = mergeConfig(defaultConfig, config);
