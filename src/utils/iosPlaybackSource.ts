import CryptoJS from "crypto-js";
import { CachesDirectoryPath, exists, mkdir, moveFile, readDir, stopDownload, unlink } from "react-native-fs";
import { downloadAudioFile } from "./audioFile";

const cacheDirectory = `${CachesDirectoryPath}/TrackPlayer/MusicFreePlayback`;
const maxCacheAge = 24 * 60 * 60 * 1000;
const maxCacheBytes = 256 * 1024 * 1024;

async function pruneCache(preservePath: string) {
    const entries = (await readDir(cacheDirectory)).sort((a, b) => (b.mtime?.getTime() ?? 0) - (a.mtime?.getTime() ?? 0));
    let bytes = entries.find(entry => entry.path === preservePath)?.size ?? 0;
    for (const entry of entries) {
        if (entry.path === preservePath || entry.name.endsWith(".tmp")) continue;
        bytes += entry.size;
        if (bytes > maxCacheBytes || (entry.mtime && Date.now() - entry.mtime.getTime() > maxCacheAge)) {
            await unlink(entry.path).catch(() => {});
        }
    }
}

/** Some media servers ignore byte ranges; AVPlayer can still play their full file. */
export function downloadPlaybackSource(url: string, headers?: Record<string, string>) {
    let cancelled = false;
    let jobId: number | undefined;
    const promise = (async () => {
        await mkdir(cacheDirectory);
        const digest = CryptoJS.SHA256(JSON.stringify([url, headers])).toString();
        const entries = await readDir(cacheDirectory);
        const cached = entries.find(entry => entry.name.startsWith(`${digest}.`) && !entry.name.endsWith(".tmp") && entry.size > 0);
        if (cancelled) return null;
        if (cached) {
            await pruneCache(cached.path);
            return cancelled ? null : `file://${cached.path}`;
        }

        // Keep recent files for replay without allowing fallback downloads to grow forever.
        for (const entry of entries) {
            if (entry.mtime && Date.now() - entry.mtime.getTime() > maxCacheAge) {
                await unlink(entry.path).catch(() => {});
            }
        }
        if (cancelled) return null;
        const temporaryPath = `${cacheDirectory}/${digest}-${Date.now()}.tmp`;
        try {
            const job = downloadAudioFile({ fromUrl: url, toFile: temporaryPath, headers });
            jobId = job.jobId;
            let timer: ReturnType<typeof setTimeout> | undefined;
            let result: Awaited<typeof job.promise>;
            try {
                result = await Promise.race([
                    job.promise,
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => {
                            stopDownload(job.jobId);
                            reject(new Error("Playback download timed out"));
                        }, 30000);
                    }),
                ]);
            } finally {
                clearTimeout(timer);
            }
            if (cancelled) return null;
            const target = `${cacheDirectory}/${digest}.${result.extension}`;
            await moveFile(temporaryPath, target);
            await pruneCache(target);
            return `file://${target}`;
        } finally {
            if (await exists(temporaryPath)) await unlink(temporaryPath).catch(() => {});
        }
    })();
    return {
        promise,
        cancel() {
            cancelled = true;
            if (jobId !== undefined) stopDownload(jobId);
        },
    };
}
