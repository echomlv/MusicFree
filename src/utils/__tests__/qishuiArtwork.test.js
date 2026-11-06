const {normalizeQishuiArtwork} = require('../qishuiArtwork');
it('repairs legacy public Qishui cover URLs without changing complete or signed URLs', () => {
    for (const uri of ['ies-music/pgc_cover_3656fc2edd76a1f76f5ef87ee9818998','tos-cn-v-2774c002/c4b910a63c6d4e95bac7926928147dbb']) {
        const raw = 'https://p3-luna.douyinpic.com/img/' + uri;
        const complete = raw + '~tplv-b829550vbb-resize:960:960.png';
        expect(normalizeQishuiArtwork(raw)).toBe(complete);
        expect(normalizeQishuiArtwork(complete)).toBe(complete);
        expect(normalizeQishuiArtwork(raw + '?signature=a%2Bb')).toBe(raw + '?signature=a%2Bb');
    }
    expect(normalizeQishuiArtwork('https://image.example.test/cover.png')).toBe('https://image.example.test/cover.png');
    expect(normalizeQishuiArtwork('file:///cache/cover.png')).toBe('file:///cache/cover.png');
    expect(normalizeQishuiArtwork('')).toBe('');
});
