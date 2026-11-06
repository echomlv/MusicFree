/** Repair legacy Qishui ImageX covers before a saved track reaches UI/native image loaders. */
export function normalizeQishuiArtwork(url: string): string {
    if (!/^https?:\/\/p\d+-luna\.douyinpic\.com\/img\/[^?#]+$/i.test(url) || /~|%7e/i.test(url)) return url;
    return url + "~tplv-b829550vbb-resize:960:960.png";
}
