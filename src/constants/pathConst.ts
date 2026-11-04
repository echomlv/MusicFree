import { Platform } from "react-native";
import RNFS, { CachesDirectoryPath } from "react-native-fs";

export const basePath =
    Platform.OS === "android"
        ? RNFS.ExternalDirectoryPath
        : RNFS.DocumentDirectoryPath;

export default {
    basePath,
    pluginPath: `${basePath}/plugins/`,
    logPath: `${basePath}/log/`,
    dataPath: `${basePath}/data/`,
    cachePath: `${basePath}/cache/`,
    musicCachePath: CachesDirectoryPath + "/TrackPlayer",
    imageCachePath: CachesDirectoryPath + (Platform.OS === "ios" ? "/com.hackemist.SDImageCache/default" : "/image_manager_disk_cache"),
    localLrcPath: `${basePath}/local_lrc/`,
    importedMusicPath: `${basePath}/imported_music`,
    lrcCachePath: `${basePath}/cache/lrc/`,
    downloadCachePath: `${basePath}/cache/download/`,
    downloadPath: `${basePath}/download/`,
    downloadMusicPath: `${basePath}/download/music/`,
    mmkvPath: `${basePath}/mmkv`,
    mmkvCachePath: `${basePath}/cache/mmkv`,
};
