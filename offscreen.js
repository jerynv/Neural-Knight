let engine = null;

function initEngine(threads, hash) {
    if (engine) { engine.terminate(); engine = null; }

    engine = new Worker('stockfish-engine.js');

    engine.onmessage = (e) => {
        if (typeof e.data === 'string') {
            chrome.runtime.sendMessage({ type: 'engineOutput', line: e.data });
        }
    };

    engine.onerror = (err) => {
        console.error('[Offscreen] Worker error:', err.message || err);
    };

    engine.postMessage('uci');
    engine.postMessage('setoption name Threads value ' + (threads || 1));
    engine.postMessage('setoption name Hash value ' + (hash || 16));
    engine.postMessage('isready');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'engineInit') {
        initEngine(msg.threads, msg.hash);
        sendResponse({ ok: true });
    } else if (msg.type === 'engineCommand') {
        if (engine) engine.postMessage(msg.command);
        sendResponse({ ok: true });
    }
});
