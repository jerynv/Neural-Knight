<p align="center">
  <img src="banner.png" alt="Neural Knight" width="700">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-brightgreen" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
</p>

## Features

- **Local Stockfish Engine** — Runs entirely in your browser via Web Worker. No external API dependencies.
- **Evaluation Bar** — Vertical eval bar positioned next to the board. Animated, perspective-aware (flips for black).
- **Best Move Hints** — Subtle dot indicators on the board showing the engine's recommended move.
- **Two Dot Modes** — *Inconspicuous* (tiny, color-matched dots that blend into the board) or *Normal* (visible black dots).
- **Independent Controls** — Eval bar and analysis engine can be toggled on/off separately.
- **Configurable Engine** — Adjust search depth, CPU threads, and hash table size from the popup.
- **Your Turn Only** — Move hints only appear when it's your turn to play.
- **Native Detection** — Automatically hides the custom eval bar when Chess.com's built-in evaluation is active.

## Install

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder
5. Open a game on [chess.com](https://www.chess.com)

## Architecture

```
content.js        — Injected into chess.com. Reads moves, renders eval bar & dot hints.
background.js     — Service worker. Routes messages between content script and engine.
offscreen.js      — Offscreen document. Hosts the Stockfish Web Worker (MV3 requirement).
popup.html/js     — Extension popup. Toggle controls and engine settings.
chess.js           — Chess.js library for move validation and FEN generation.
stockfish-engine.js — Stockfish 10 compiled to JavaScript.
```

**Data flow:**

```
Chess.com move list → content.js extracts moves → chess.js generates FEN
→ background.js routes to offscreen.js → Stockfish Worker analyzes
→ result flows back → content.js updates eval bar + dot hints
```

## Settings

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Depth | 8–24 | 14 | Search depth. Higher = stronger but slower |
| Threads | 1–16 | 1 | CPU cores for the engine |
| Hash | 16–1024 MB | 16 | Memory allocated for position cache |

## Permissions

- `storage` — Save user preferences
- `activeTab` / `tabs` — Communicate with chess.com tabs
- `offscreen` — Run Stockfish Web Worker (MV3 restriction)

## License

Knight icon from [Game Icons](https://game-icons.net/1x1/skoll/chess-knight.html) — [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
