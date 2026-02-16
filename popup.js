const DEFAULTS = { depth: 14, threads: 4, hash: 256 };

document.addEventListener('DOMContentLoaded', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url || '';

    if (!url.includes('chess.com')) {
        document.getElementById('not-chess').style.display = 'block';
        return;
    }

    document.getElementById('main-content').style.display = 'block';

    const $ = (id) => document.getElementById(id);
    const toggleBtn = $('toggle-btn');
    const evalDot = $('evalbar-dot');
    const evalText = $('evalbar-text');
    const engineToggle = $('engine-toggle');
    const engineDot = $('engine-dot');
    const engineText = $('engine-text');
    const hintsToggle = $('hints-toggle');
    const hintsDot = $('hints-dot');
    const hintsText = $('hints-text');
    const dotMode = $('dot-mode');
    const depth = $('set-depth');
    const threads = $('set-threads');
    const hash = $('set-hash');
    const saveBtn = $('save-btn');

    function sendMsg(message) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabs[0].id, message, (r) => {
                resolve(chrome.runtime.lastError ? null : r);
            });
        });
    }

    async function updateUI() {
        const r = await sendMsg({ action: 'getState' });
        const evalOn = r?.evalBarVisible;
        const engineOn = r?.analysisEnabled !== false;
        const hintsOn = r?.hintsEnabled !== false;

        toggleBtn.classList.toggle('on', !!evalOn);
        evalDot.className = evalOn ? 'dot' : 'dot off';
        evalText.textContent = evalOn ? 'Active' : 'Off';

        engineToggle.classList.toggle('on', engineOn);
        engineDot.className = engineOn ? 'dot' : 'dot off';
        engineText.textContent = engineOn ? 'Active' : 'Off';

        hintsToggle.classList.toggle('on', hintsOn);
        hintsDot.className = hintsOn ? 'dot' : 'dot off';
        hintsText.textContent = hintsOn ? 'Active' : 'Off';
    }

    toggleBtn.onclick = async () => { await sendMsg({ action: 'toggleEvalBar' }); updateUI(); };
    engineToggle.onclick = async () => { await sendMsg({ action: 'toggleAnalysis' }); updateUI(); };
    hintsToggle.onclick = async () => { await sendMsg({ action: 'toggleHints' }); updateUI(); };

    chrome.storage.local.get(['dotMode'], (r) => { dotMode.value = r.dotMode || 'inconspicuous'; });
    dotMode.onchange = () => chrome.storage.local.set({ dotMode: dotMode.value });

    chrome.storage.local.get(['engineDepth', 'engineThreads', 'engineHash'], (r) => {
        depth.value = r.engineDepth || DEFAULTS.depth;
        threads.value = r.engineThreads || DEFAULTS.threads;
        hash.value = r.engineHash || DEFAULTS.hash;
    });

    saveBtn.onclick = () => {
        const d = Math.min(24, Math.max(8, parseInt(depth.value) || DEFAULTS.depth));
        const t = Math.min(16, Math.max(1, parseInt(threads.value) || DEFAULTS.threads));
        const h = Math.min(1024, Math.max(16, parseInt(hash.value) || DEFAULTS.hash));
        depth.value = d; threads.value = t; hash.value = h;

        chrome.storage.local.set({ engineDepth: d, engineThreads: t, engineHash: h }, () => {
            chrome.runtime.sendMessage({ action: 'restartEngine', threads: t, hash: h });
            saveBtn.textContent = 'Saved';
            saveBtn.classList.add('saved');
            setTimeout(() => { saveBtn.textContent = 'Save & Restart Engine'; saveBtn.classList.remove('saved'); }, 1500);
        });
    };

    updateUI();
});
