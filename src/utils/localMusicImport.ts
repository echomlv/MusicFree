import pathConst from "@/constants/pathConst";
import { supportLocalMediaType } from "@/constants/commonConst";
import LocalMusicSheet from "@/core/localMusicSheet";
import PluginManager from "@/core/pluginManager";
import { localPluginHash } from "@/constants/commonConst";
import { getFileName } from "@/utils/fileUtils";
import { getDocumentAsync } from "expo-document-picker";
import { copyAsync } from "expo-file-system";
import { hash, exists, mkdir, unlink } from "react-native-fs";

/** Copy picker cache files into Documents before saving their paths in the library. */
export async function importLocalMusicFiles(): Promise<boolean> {
    const result = await getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
    });
    if (result.canceled) {
        return false;
    }

    const plugin = PluginManager.getByHash(localPluginHash);
    if (!plugin?.instance.importMusicItem) {
        throw new Error("Local music is not initialized");
    }
    const musicAssets = result.assets.filter(asset =>
        supportLocalMediaType.some(ext => asset.name.toLowerCase().endsWith(ext)),
    );
    if (!musicAssets.length) {
        throw new Error("请选择音频文件 / Please select audio files");
    }

    await mkdir(pathConst.importedMusicPath);
    for (const asset of musicAssets) {
        // Content hashes prevent duplicate imports and keep filenames readable.
        const digest = await hash(decodeURIComponent(asset.uri.replace(/^file:\/\//, "")), "md5");
        const filename = getFileName(asset.name).replace(/[\\/:]/g, "_");
        const directory = `${pathConst.importedMusicPath}/${digest}`;
        await mkdir(directory);
        const target = `${directory}/${filename}`;
        const alreadyExists = await exists(target);
        if (!alreadyExists) {
            await copyAsync({ from: asset.uri, to: `file://${target}` });
        }
        try {
            const musicItem = await plugin.instance.importMusicItem(target);
            if (musicItem) {
                await LocalMusicSheet.addMusic(musicItem);
            }
        } catch (error) {
            if (!alreadyExists) {
                await unlink(target);
            }
            throw error;
        }
    }
    return true;
}
