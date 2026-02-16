let engineReady = false;
let pendingResolve = null;
let bestMove = null;
let evalScore = null;
let mateScore = null;
let engineThreads = 4;
let engineHash = 256;
let offscreenCreated = false;

async function ensureOffscreen() {
    if (offscreenCreated) {
        console.log('[Neural Knight BG] Offscreen already created');
        return;
    }
    
    console.log('[Neural Knight BG] Checking for existing offscreen contexts...');
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length > 0) { 
        offscreenCreated = true;
        console.log('[Neural Knight BG] Offscreen context found:', contexts.length);
        return;
    }

    console.log('[Neural Knight BG] Creating offscreen document...');
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['WORKERS'],
            justification: 'Run Stockfish chess engine in a Web Worker'
        });
        offscreenCreated = true;
        console.log('[Neural Knight BG] Offscreen document created successfully');
    } catch (err) {
        console.error('[Neural Knight BG] Failed to create offscreen:', err);
        throw err;
    }
}

async function initEngine() {
    console.log('[Neural Knight BG] Initializing engine...');
    engineReady = false;
    await ensureOffscreen();
    console.log('[Neural Knight BG] Sending engineInit to offscreen');
    chrome.runtime.sendMessage({ type: 'engineInit', threads: engineThreads, hash: engineHash });
}

function sendCmd(command) {
    try {
        chrome.runtime.sendMessage({ type: 'engineCommand', command });
    } catch (err) {
        console.error('[Neural Knight BG] Failed to send command:', err);
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'engineOutput') {
        const line = msg.line;
        if (typeof line !== 'string') return;

        if (line === 'readyok') {
            engineReady = true;
            console.log('[Neural Knight BG] Engine ready!');
        }

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

            console.log('[Neural Knight BG] Analysis complete. Best move:', bestMove, 'Eval:', evalScore, 'Mate:', mateScore);

            if (pendingResolve) {
                pendingResolve({ continuation: bestMove || '', evaluation: evalScore, mate: mateScore });
                pendingResolve = null;
            }
            bestMove = null; evalScore = null; mateScore = null;
        }
        return;
    }

    if (msg.action === 'analyze') {
        console.log('[Neural Knight BG] Received analyze request, FEN:', msg.fen?.substring(0, 30) + '...');
        const run = () => doAnalysis(msg.fen, msg.depth, sendResponse);

        if (!offscreenCreated) {
            console.log('[Neural Knight BG] Offscreen not created, initializing...');
            initEngine().then(() => waitReady(run)).catch(err => {
                console.error('[Neural Knight BG] Init failed:', err);
                sendResponse({ continuation: '', evaluation: 0, mate: null });
            });
            return true;
        }
        if (!engineReady) {
            console.log('[Neural Knight BG] Engine not ready, waiting...');
            waitReady(run);
            return true;
        }

        console.log('[Neural Knight BG] Running analysis immediately');
        run();
        return true;
    }

    if (msg.action === 'restartEngine') {
        engineThreads = msg.threads || 4;
        engineHash = msg.hash || 256;
        console.log('[Neural Knight BG] Restarting engine with threads:', engineThreads, 'hash:', engineHash);
        initEngine().catch(err => {
            console.error('[Neural Knight BG] Restart failed:', err);
        });
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
    if (pendingResolve) { 
        console.log('[Neural Knight BG] Canceling previous analysis');
        pendingResolve(null); 
        pendingResolve = null; 
    }
    bestMove = null; evalScore = null; mateScore = null;
    pendingResolve = sendResponse;

    console.log('[Neural Knight BG] Starting analysis at depth', depth);
    sendCmd('stop');
    sendCmd('position fen ' + fen);
    sendCmd('go depth ' + (depth || 14));
    
    // Safety timeout - if engine doesn't respond in 30 seconds, fail gracefully
    setTimeout(() => {
        if (pendingResolve === sendResponse) {
            console.error('[Neural Knight BG] Analysis timeout');
            pendingResolve({ continuation: '', evaluation: 0, mate: null });
            pendingResolve = null;
        }
    }, 30000);
}

chrome.storage.local.get(['engineThreads', 'engineHash'], (res) => {
    engineThreads = res.engineThreads || 4;
    engineHash = res.engineHash || 256;
    console.log('[Neural Knight BG] Starting with threads:', engineThreads, 'hash:', engineHash);
    initEngine().catch(err => {
        console.error('[Neural Knight BG] Failed to initialize engine on startup:', err);
    });
});
