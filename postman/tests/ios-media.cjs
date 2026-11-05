// Run against the booted Debug app after starting ios-media.sim.yaml.
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

(async () => {
    const device = process.env.MUSICFREE_DEVICE || 'iPhone 16e';
    const targets = await (await fetch('http://localhost:8081/json/list')).json();
    const target = targets.find(item => item.deviceName === device && item.title.startsWith('React Native Bridge'));
    if (!target) throw new Error(`No running MusicFree Debug app on ${device}`);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map();
    let nextId = 1;
    const call = (method, params) => new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, {resolve, reject});
        socket.send(JSON.stringify({id, method, params}));
    });
    socket.on('message', bytes => {
        const message = JSON.parse(bytes);
        const request = pending.get(message.id);
        if (request) {
            pending.delete(message.id);
            if (message.error) request.reject(message.error);
            else request.resolve(message.result);
        }
    });
    socket.on('close', () => {
        for (const request of pending.values()) request.reject(new Error('App inspector disconnected'));
        pending.clear();
    });
    await new Promise((resolve, reject) => {socket.once('open', resolve); socket.once('error', reject);});
    try {
        await call('Runtime.enable', {});
        const source = fs.readFileSync(path.join(__dirname, 'ios-media.runtime.js'), 'utf8');
        const initial = await call('Runtime.evaluate', {expression: source, returnByValue: true});
        if (initial.exceptionDetails) throw new Error(initial.exceptionDetails.text);
        for (let attempt = 0; attempt < 240; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 250));
            const result = await call('Runtime.evaluate', {
                expression: '__r.__mediaSmoke && __r.__mediaSmoke.done ? __r.__mediaSmoke : null', returnByValue: true,
            });
            if (result.result?.value) {
                console.log(JSON.stringify(result.result.value, null, 2));
                if (result.result.value.error) process.exitCode = 1;
                return;
            }
        }
        throw new Error('Media smoke test timed out; inspect __r.__mediaSmoke in the Debug app');
    } finally {
        socket.close();
    }
})().catch(error => {console.error(error.message); process.exitCode = 1;});
