let engine = null;

function initEngine(threads, hash) {
    console.log('[Neural Knight Offscreen] Initializing engine with threads:', threads, 'hash:', hash);
    if (engine) { 
        console.log('[Neural Knight Offscreen] Terminating existing engine');
        engine.terminate(); 
        engine = null; 
    }

    console.log('[Neural Knight Offscreen] Creating Stockfish worker...');
    engine = new Worker('stockfish-engine.js');

    engine.onmessage = (e) => {
        if (typeof e.data === 'string') {
            console.log('[Neural Knight Offscreen] Engine output:', e.data);
            chrome.runtime.sendMessage({ type: 'engineOutput', line: e.data });
        }
    };

    engine.onerror = (err) => {
        console.error('[Neural Knight Offscreen] Worker error:', err.message || err);
    };

    console.log('[Neural Knight Offscreen] Sending UCI commands...');
    engine.postMessage('uci');
    engine.postMessage('setoption name Threads value ' + (threads || 4));
    engine.postMessage('setoption name Hash value ' + (hash || 256));
    engine.postMessage('isready');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Neural Knight Offscreen] Received message:', msg.type);
    if (msg.type === 'engineInit') {
        initEngine(msg.threads, msg.hash);
        sendResponse({ ok: true });
        return true;
    } else if (msg.type === 'engineCommand') {
        console.log('[Neural Knight Offscreen] Engine command:', msg.command);
        if (engine) {
            engine.postMessage(msg.command);
        } else {
            console.error('[Neural Knight Offscreen] Engine not initialized!');
        }
        sendResponse({ ok: true });
        return true;
    }
    return false;
});
