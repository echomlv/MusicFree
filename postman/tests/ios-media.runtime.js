/* global __r */
// Evaluated inside Hermes: exercise the real app, RNFS and AVPlayer, then restore data.
(function () {
    function load(suffix) {
        return __r([...__r.getModules()].find(function (entry) {
            return (entry[1].verboseName || '').endsWith(suffix);
        })[0]);
    }
    var player = load('src/core/trackPlayer/index.ts').default;
    var native = load('node_modules/react-native-track-player/src/index.ts').default;
    var config = load('src/core/appConfig.ts').default;
    var history = load('src/core/musicHistory.ts').default;
    var local = load('src/core/localMusicSheet.ts').default;
    var fs = load('node_modules/react-native-fs/FS.common.js');
    var paths = load('src/constants/pathConst.ts').default;
    var persist = load('src/utils/persistStatus.ts').default;
    var helper = load('src/utils/audioFile.ts');
    var wait = load('src/utils/delay.ts').default;
    var out = __r.__mediaSmoke = {done: false, checks: []};
    var token = String(Date.now());
    var source = {id: token, platform: 'MusicFree media smoke', title: 'Temporary HTTP fixture', url: 'http://localhost:4510/media/requires-full.wav'};
    var backup = {queue: player.playList.slice(), music: player.currentMusic, repeat: player.repeatMode, history: history.history.slice(), autoStop: config.getConfig('basic.autoStopWhenError')};
    var files = [];
    function assert(condition, message) {if (!condition) throw new Error(message);}
    function cleanup() {
        return player.pause().then(function () {
            player.setRepeatMode(backup.repeat);
            player.setPlayList(backup.queue);
            player.setCurrentMusic(backup.music);
            return native.setQueue(backup.track ? [backup.track] : []);
        }).then(function () {
            return native.seekTo(backup.progress.position).catch(function () {});
        }).then(function () {
            persist.set('music.musicItem', backup.music);
            persist.set('music.progress', backup.progress.position);
            config.setConfig('basic.autoStopWhenError', backup.autoStop);
            return history.setHistory(backup.history);
        }).then(function () {
            return backup.state.state === 'playing' ? player.play() : native.pause();
        }).then(function () {
            return Promise.all(files.map(function (file) {return fs.unlink(file).catch(function () {});}));
        });
    }
    Promise.all([native.getActiveTrack(), native.getProgress(), native.getPlaybackState()]).then(function (values) {
        backup.track = values[0]; backup.progress = values[1]; backup.state = values[2];
        config.setConfig('basic.autoStopWhenError', true);
        return player.playWithReplacePlayList(source, [source]);
    }).then(function () {
        var start = Date.now();
        function check() {
            return Promise.all([native.getPlaybackState(), native.getActiveTrack()]).then(function (values) {
                if (values[0].state === 'playing' && values[1].url.indexOf('file:') === 0) {
                    out.checks.push('Range failure recovered through a full download and native local playback');
                    return;
                }
                assert(Date.now() - start < 15000, 'Playback did not recover from a range failure');
                return wait(100).then(check);
            });
        }
        return check();
    }).then(function () {return player.pause();}).then(function () {
        var chain = Promise.resolve();
        ['forbidden.mp3', 'unavailable.mp3', 'empty.mp3', 'wrong-extension.mp3'].forEach(function (name) {
            chain = chain.then(function () {
                var target = paths.cachePath + 'media-smoke-' + token + '-' + name;
                files.push(target);
                return helper.downloadAudioFile({fromUrl: 'http://localhost:4510/media/' + name, toFile: target}).promise.then(function (result) {
                    assert(name === 'wrong-extension.mp3' && result.extension === 'wav', 'Incorrect audio signature or unexpected download success');
                    out.checks.push('File signature overrides misleading mp3 URL and MIME');
                }, function (error) {
                    var expected = {'forbidden.mp3': 'HTTP 403', 'unavailable.mp3': 'HTTP 503', 'empty.mp3': 'empty'}[name];
                    assert(expected && error.message.indexOf(expected) >= 0, error.message);
                    out.checks.push(name + ': ' + error.message);
                });
            });
        });
        return chain;
    }).catch(function (error) {
        out.error = error.message;
    }).then(cleanup).then(function () {
        assert(local.getMusicList().every(function (item) {return item.platform !== source.platform;}), 'Unexpected local library mutation');
        out.restored = true;
        out.done = true;
    }, function (error) {out.error = (out.error || '') + ' Cleanup: ' + error.message; out.done = true;});
    return 'Running iOS media smoke tests';
})()
