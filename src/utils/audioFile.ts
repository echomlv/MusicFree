import CryptoJS from "crypto-js";
import { DownloadFileOptions, downloadFile, read, stat, unlink } from "react-native-fs";

const mimeExtensions: Record<string, string> = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/flac": "flac", "audio/x-flac": "flac",
    "audio/mp4": "m4a", "audio/x-m4a": "m4a",
    "audio/aac": "aac", "audio/aacp": "aac",
    "audio/wav": "wav", "audio/x-wav": "wav",
    "audio/ogg": "ogg", "application/ogg": "ogg",
};

export function getHeader(headers: Record<string, string>, name: string) {
    const key = Object.keys(headers).find(item => item.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
}

/** Prefer the file signature: signed URLs and Content-Type can both be misleading. */
export async function getAudioExtension(file: string, contentType = "", url = "") {
    const bytes = CryptoJS.enc.Base64.parse(await read(file, 64, 0, "base64"));
    const header = bytes.toString();
    if (header.startsWith("664c6143")) return "flac";
    if (/^fff[0189]/.test(header)) return "aac";
    if (header.startsWith("494433") || /^ff[ef][0-9a-f]/.test(header)) return "mp3";
    if (header.slice(8, 16) === "66747970") return "m4a";
    if (header.startsWith("52494646") && header.slice(16, 24) === "57415645") return "wav";
    if (header.startsWith("4f676753")) return "ogg";
    const mime = contentType.split(";")[0].trim().toLowerCase();
    if (/^(text\/|application\/(json|xml))/.test(mime) ||
        /^(?:<!doctype|<html|<\?xml|\{\s*"|\[\s*\{)/i.test(bytes.toString(CryptoJS.enc.Latin1).trimStart())) {
        throw new Error(`Expected audio, received ${mime}`);
    }
    return mimeExtensions[mime] ?? url.split(/[?#]/)[0].match(/\.(mp3|flac|m4a|aac|wav|ogg|opus|ape|wma)$/i)?.[1].toLowerCase() ?? "mp3";
}

/** Validate HTTP and file contents before a caller publishes a downloaded track. */
export function downloadAudioFile(options: DownloadFileOptions) {
    let contentType = "";
    const job = downloadFile({
        connectionTimeout: 15000,
        readTimeout: 30000,
        ...options,
        begin: response => {
            contentType = getHeader(response.headers ?? {}, "content-type") ?? "";
            options.begin?.(response);
        },
    });
    const promise = job.promise.then(async response => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`Audio download failed: HTTP ${response.statusCode}`);
        }
        if (!response.bytesWritten || !(await stat(options.toFile)).size) {
            throw new Error("Audio download returned an empty file");
        }
        const extension = await getAudioExtension(options.toFile, contentType, options.fromUrl);
        return { ...response, extension };
    }).catch(async error => {
        await unlink(options.toFile).catch(() => {});
        throw error;
    });
    return { ...job, promise };
}
