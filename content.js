let evalBarVisible = true;
let analysisEnabled = true;
let hintsEnabled = true;
let dotMode = 'inconspicuous';
let moveListObserver = null;
let previousNumber = 0;
let previousFen = '';
let engineDepth = 14;

const MOVE_LIST_SEL = 'wc-simple-move-list';

// --- Storage & Messaging ---

chrome.storage.local.get(['evalBarVisible', 'analysisEnabled', 'hintsEnabled', 'dotMode', 'engineDepth'], (res) => {
    if (res.evalBarVisible !== undefined) evalBarVisible = res.evalBarVisible;
    if (res.analysisEnabled !== undefined) analysisEnabled = res.analysisEnabled;
    if (res.hintsEnabled !== undefined) hintsEnabled = res.hintsEnabled;
    if (res.dotMode) dotMode = res.dotMode;
    if (res.engineDepth) engineDepth = res.engineDepth;
    init();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.engineDepth) engineDepth = changes.engineDepth.newValue;
    if (changes.dotMode) dotMode = changes.dotMode.newValue;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const state = () => ({ evalBarVisible, analysisEnabled, hintsEnabled });

    if (msg.action === 'toggleEvalBar') {
        evalBarVisible = !evalBarVisible;
        chrome.storage.local.set({ evalBarVisible });
        updateEvalBarVisibility();
        sendResponse(state());
    } else if (msg.action === 'toggleAnalysis') {
        analysisEnabled = !analysisEnabled;
        chrome.storage.local.set({ analysisEnabled });
        if (!analysisEnabled) clearHighlights();
        sendResponse(state());
    } else if (msg.action === 'toggleHints') {
        hintsEnabled = !hintsEnabled;
        chrome.storage.local.set({ hintsEnabled });
        if (!hintsEnabled) clearHighlights();
        sendResponse(state());
    } else if (msg.action === 'getState') {
        sendResponse(state());
    } else {
        sendResponse({});
    }
    return true; // Keep message channel open for async responses
});

// --- Eval Bar ---

function updateEvalBarVisibility() {
    const el = document.getElementById('ca-eval-wrap');
    if (el) el.style.display = evalBarVisible ? 'block' : 'none';
}

function injectEvalBar() {
    const native = document.getElementById('board-layout-evaluation');
    if (native && native.querySelector('.evaluation-bar-bar')) return;

    const existing = document.getElementById('ca-eval-wrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'ca-eval-wrap';
    Object.assign(wrap.style, {
        position: 'absolute', top: '0', left: '-38px',
        width: '28px', height: '100%', overflow: 'hidden',
        boxSizing: 'border-box', padding: '0', margin: '0',
        border: 'none', zIndex: '100'
    });

    const track = document.createElement('div');
    track.id = 'ca-eval-track';
    Object.assign(track.style, {
        width: '100%', height: '100%', background: '#1a1a1a',
        position: 'relative', overflow: 'hidden',
        boxSizing: 'border-box', padding: '0', margin: '0', border: 'none'
    });

    const fill = document.createElement('div');
    fill.id = 'ca-eval-fill';
    Object.assign(fill.style, {
        position: 'absolute', bottom: '0', left: '0', right: '0',
        height: '50%', background: '#f0f0f0',
        boxSizing: 'border-box', padding: '0', margin: '0', border: 'none'
    });

    const score = document.createElement('div');
    score.id = 'ca-eval-score';
    score.textContent = '0.0';
    Object.assign(score.style, {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(30,30,30,0.8)', color: '#fff',
        fontFamily: "'SF Mono','Menlo','Consolas',monospace",
        fontSize: '9px', fontWeight: '400',
        padding: '3px 2px', borderRadius: '3px',
        whiteSpace: 'nowrap', zIndex: '2',
        letterSpacing: '-0.3px', lineHeight: '1',
        pointerEvents: 'none', textOrientation: 'mixed',
        backdropFilter: 'blur(4px)',
        boxSizing: 'border-box', margin: '0', border: 'none'
    });

    track.appendChild(fill);
    track.appendChild(score);
    wrap.appendChild(track);

    if (!placeEvalBar(wrap)) {
        const poll = setInterval(() => {
            if (placeEvalBar(wrap)) clearInterval(poll);
        }, 500);
    }
    updateEvalBarVisibility();
}

function placeEvalBar(wrap) {
    const board = document.querySelector('.board-layout-chessboard');
    if (!board) return false;
    if (window.getComputedStyle(board).position === 'static') {
        board.style.position = 'relative';
    }
    board.appendChild(wrap);
    return true;
}

function setEval(value) {
    const min = -12, max = 12;
    value = Math.min(Math.max(value, min), max);
    if (previousNumber >= 12 && value >= 12) return;
    if (previousNumber <= -12 && value <= -12) return;
    previousNumber = value;

    let pct = (value - min) / (max - min) * 100;
    const color = getPlayerColor();
    const fill = document.getElementById('ca-eval-fill');
    const track = document.getElementById('ca-eval-track');
    if (!fill || !track) return;

    if (color === 'black') {
        pct = 100 - pct;
        fill.style.background = '#1a1a1a';
        track.style.background = '#f0f0f0';
    } else {
        fill.style.background = '#f0f0f0';
        track.style.background = '#1a1a1a';
    }

    animateHeight(parseFloat(fill.style.height) || 50, pct);
}

function animateHeight(from, to) {
    const duration = 400, start = performance.now();
    function step(time) {
        const p = Math.min((time - start) / duration, 1);
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const bar = document.getElementById('ca-eval-fill');
        if (bar) bar.style.height = (from + (to - from) * ease) + '%';
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// --- Board Highlights ---

function clearHighlights() {
    document.querySelectorAll('.ca-dot').forEach(el => el.remove());
}

function coordToXY(coord) {
    return {
        x: coord.charCodeAt(0) - 96,
        y: parseInt(coord[1], 10)
    };
}

function getPlayerColor() {
    const board = document.querySelector('wc-chess-board');
    if (!board) return '';
    return board.classList.contains('flipped') ? 'black' : 'white';
}

function addDot(coord) {
    const { x, y } = coordToXY(coord);
    const flipped = getPlayerColor() === 'black';
    const light = (x + y) % 2 !== 0;

    const board = document.querySelector('wc-chess-board')
        || document.getElementById('board-play-computer')
        || document.getElementById('board-single');
    if (!board) return;

    if (window.getComputedStyle(board).position === 'static') {
        board.style.position = 'relative';
    }

    const overlay = document.createElement('div');
    overlay.className = 'ca-dot';
    const left = flipped ? (8 - x) : (x - 1);
    const bottom = flipped ? (8 - y) : (y - 1);

    Object.assign(overlay.style, {
        display: 'block', position: 'absolute',
        bottom: `calc(${bottom}/8*100%)`, left: `calc(${left}/8*100%)`,
        width: 'calc(100%/8)', height: 'calc(100%/8)',
        pointerEvents: 'none', backgroundColor: 'transparent',
        zIndex: '9999'
    });

    const normal = dotMode === 'normal';
    const dot = document.createElement('div');
    Object.assign(dot.style, {
        position: 'absolute',
        bottom: normal ? '3px' : '4px',
        right: normal ? '3px' : '4px',
        width: normal ? '5px' : '2px',
        height: normal ? '5px' : '2px',
        borderRadius: '50%',
        backgroundColor: normal
            ? '#1a1a1a'
            : (light ? 'rgba(131,131,131,0.43)' : 'rgba(171,171,171,0.66)'),
        boxShadow: normal ? 'none' : '0 0 3px rgba(220,53,53,0.5)',
        pointerEvents: 'none'
    });

    overlay.appendChild(dot);
    board.appendChild(overlay);
}

// --- Analysis ---

function analyzePosition(fen, depth) {
    if (!analysisEnabled || fen === previousFen) return;

    console.log('[Neural Knight] Analyzing position:', fen.substring(0, 30) + '...', 'depth:', depth);

    try {
        chrome.runtime.sendMessage({ action: 'analyze', fen, depth }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Neural Knight] Analysis failed:', chrome.runtime.lastError.message);
                return;
            }
            if (!response) {
                console.warn('[Neural Knight] No response from background');
                return;
            }
            console.log('[Neural Knight] Analysis received:', response);
            handleAnalysis(response, fen);
        });
    } catch (err) {
        console.error('[Neural Knight] Exception in analyzePosition:', err);
    }
}

function handleAnalysis(data, fen) {
    previousFen = fen;
    const turn = getTurnFromFEN(fen);
    const player = getPlayerColor();
    const scoreEl = document.getElementById('ca-eval-score');

    // Eval score (perspective-adjusted)
    if (data.evaluation != null && scoreEl) {
        const adj = turn === 'black' ? -data.evaluation : data.evaluation;
        scoreEl.textContent = adj > 0 ? `+${adj}` : `${adj}`;
        setEval(adj);
    }

    // Mate score (perspective-adjusted)
    if (data.mate != null && scoreEl) {
        const adj = turn === 'black' ? -data.mate : data.mate;
        scoreEl.textContent = adj > 0 ? `M${adj}` : `M${adj}`;
        setEval(adj > 0 ? 12 : -12);
    }

    // Best move highlights (your turn only, if hints enabled)
    clearHighlights();
    if (hintsEnabled) {
        const bestMove = data.continuation ? data.continuation.split(' ')[0] : null;
        if (bestMove && turn && player && player === turn) {
            addDot(bestMove.slice(0, 2));
            addDot(bestMove.slice(2, 4));
        }
    }
}

// --- Move Extraction & FEN ---

function getTurnFromFEN(fen) {
    const parts = fen.trim().split(' ');
    if (parts.length < 2) return '';
    return parts[1] === 'w' ? 'white' : parts[1] === 'b' ? 'black' : '';
}

function extractAndAnalyze() {
    const moveList = document.querySelector(MOVE_LIST_SEL);
    if (!moveList) return;

    if (moveList.innerHTML.includes('game-result')) {
        clearHighlights();
        observeMoveList();
        return;
    }

    let moves = '';
    moveList.querySelectorAll('.move-list-row').forEach(row => {
        ['.white-move span', '.black-move span'].forEach(sel => {
            const el = row.querySelector(sel);
            if (!el) return;
            const piece = el.querySelector('.icon-font-chess');
            const prefix = piece?.getAttribute('data-figurine') || '';
            const text = prefix + el.textContent.trim();
            moves += moves ? ` ${text}` : text;
        });
    });

    if (!moves) return;

    if (typeof Chess === 'undefined') return;
    const game = new Chess();
    for (const raw of moves.split(/\s+/)) {
        const move = raw.replace(/=([A-Z])/i, '=Q');
        if (!game.move(move)) break;
    }

    const fen = game.fen();
    if (fen.trim()) analyzePosition(fen, engineDepth);
}

function observeMoveList(onload = false) {
    const moveList = document.querySelector(MOVE_LIST_SEL);
    if (!moveList) return;

    if (moveListObserver) moveListObserver.disconnect();

    moveListObserver = new MutationObserver(() => {
        clearHighlights();
        extractAndAnalyze();
    });
    moveListObserver.observe(moveList, { childList: true, subtree: true });

    if (onload) extractAndAnalyze();
}

// --- Init ---

function init() {
    console.log('[Neural Knight] Initializing on Chess.com...');
    injectEvalBar();
    const poll = setInterval(() => {
        if (document.querySelector(MOVE_LIST_SEL)) {
            console.log('[Neural Knight] Move list found, starting observer');
            observeMoveList(true);
            clearInterval(poll);
        }
    }, 1000);
    
    // Verify extension connection
    setTimeout(() => {
        if (!chrome.runtime?.id) {
            console.error('[Neural Knight] Extension context invalidated!');
        } else {
            console.log('[Neural Knight] Extension initialized successfully, ID:', chrome.runtime.id);
        }
    }, 500);
}
