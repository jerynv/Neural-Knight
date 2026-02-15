let engineReady = false;
let pendingResolve = null;
let bestMove = null;
let evalScore = null;
let mateScore = null;
let engineThreads = 1;
let engineHash = 16;
let offscreenCreated = false;

async function ensureOffscreen() {
    if (offscreenCreated) return;
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length > 0) { offscreenCreated = true; return; }

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Run Stockfish chess engine in a Web Worker'
    });
    offscreenCreated = true;
}

async function initEngine() {
    engineReady = false;
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: 'engineInit', threads: engineThreads, hash: engineHash });
}

function sendCmd(command) {
    chrome.runtime.sendMessage({ type: 'engineCommand', command });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'engineOutput') {
        const line = msg.line;
        if (typeof line !== 'string') return;

        if (line === 'readyok') engineReady = true;

        if (line.startsWith('info') && line.includes(' pv ')) {
            const score = line.match(/score (cp|mate) (-?\d+)/);
            if (score) {
                if (score[1] === 'cp') { evalScore = parseInt(score[2], 10) / 100; mateScore = null; }
                else { mateScore = parseInt(score[2], 10); evalScore = null; }
            }
            const pv = line.match(/ pv (.+)/);
            if (pv) bestMove = pv[1].split(' ')[0];
        }

        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            if (parts[1] && parts[1] !== '(none)') bestMove = parts[1];

            if (pendingResolve) {
                pendingResolve({ continuation: bestMove || '', evaluation: evalScore, mate: mateScore });
                pendingResolve = null;
            }
            bestMove = null; evalScore = null; mateScore = null;
        }
        return;
    }

    if (msg.action === 'analyze') {
        const run = () => doAnalysis(msg.fen, msg.depth, sendResponse);

        if (!offscreenCreated) {
            initEngine().then(() => waitReady(run));
            return true;
        }
        if (!engineReady) { waitReady(run); return true; }

        run();
        return true;
    }

    if (msg.action === 'restartEngine') {
        engineThreads = msg.threads || 1;
        engineHash = msg.hash || 16;
        initEngine();
        sendResponse({ ok: true });
        return false;
    }
});

function waitReady(cb) {
    const poll = setInterval(() => {
        if (engineReady) { clearInterval(poll); cb(); }
    }, 100);
}

function doAnalysis(fen, depth, sendResponse) {
    if (pendingResolve) { pendingResolve(null); pendingResolve = null; }
    bestMove = null; evalScore = null; mateScore = null;
    pendingResolve = sendResponse;

    sendCmd('stop');
    sendCmd('position fen ' + fen);
    sendCmd('go depth ' + (depth || 14));
}

chrome.storage.local.get(['engineThreads', 'engineHash'], (res) => {
    engineThreads = res.engineThreads || 1;
    engineHash = res.engineHash || 16;
    initEngine();
});
