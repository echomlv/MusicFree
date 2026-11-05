const http = require('http');
const {Buffer} = require('buffer');

// A tiny deterministic PCM fixture, so the real iOS audio decoder is exercised.
const samples = 22050 * 5;
const audio = Buffer.alloc(44 + samples * 2);
audio.write('RIFF', 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(22050, 24); audio.writeUInt32LE(44100, 28);
audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
audio.write('data', 36); audio.writeUInt32LE(samples * 2, 40);

http.createServer((req, res) => {
    const route = req.url.split('?')[0];
    if (route === '/forbidden.mp3' || route === '/unavailable.mp3') {
        res.writeHead(route === '/forbidden.mp3' ? 403 : 503, {'Content-Type': 'text/html'});
        return res.end('<html>Media unavailable</html>');
    }
    if (route === '/empty.mp3') {
        res.writeHead(200, {'Content-Type': 'audio/mpeg', 'Content-Length': 0});
        return res.end();
    }
    if (!['/whole.wav', '/requires-full.wav', '/wrong-extension.mp3', '/slow.wav'].includes(route)) {
        res.writeHead(501); return res.end('Not modeled');
    }
    // Model a CDN which rejects AVPlayer's range requests but allows a full GET.
    if (route === '/requires-full.wav' && req.headers.range) {
        res.writeHead(416, {'Content-Range': `bytes */${audio.length}`});
        return res.end();
    }
    const send = () => {
        res.writeHead(200, {
            'Content-Type': route === '/wrong-extension.mp3' ? 'audio/mpeg' : 'audio/wav',
            'Content-Length': audio.length,
        });
        res.end(audio);
    };
    if (route === '/slow.wav') setTimeout(send, 2500);
    else send();
}).listen(process.env.PORT || 4510);
