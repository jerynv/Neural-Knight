/**
 * Banner Generator for Chess Analyzer
 *
 * Uses sharp (https://sharp.pixelplumbing.com/) to render an SVG string to PNG.
 * sharp can take raw SVG as a Buffer and rasterize it — no browser needed.
 *
 * Run: node generate-banner.js
 * Requires: npm install sharp
 */

const sharp = require('sharp');
const path = require('path');

// --- Config ---

const WIDTH = 800;
const HEIGHT = 220;
const OUTPUT = path.join(__dirname, 'banner.png');

// Knight path data from the icon SVG (512x512 coordinate space)
const KNIGHT_PATH = `M60.81 476.91h300v-60h-300zm233.79-347.3l13.94 7.39c31.88-43.62
  61.34-31.85 61.34-31.85l-21.62 53l35.64 19l2.87 33l64.42 108.75l-43.55
  29.37s-26.82-36.39-39.65-43.66c-10.66-6-41.22-10.25-56.17-12l-67.54-76.91l-12
  10.56l37.15 42.31c-.13.18-.25.37-.38.57c-35.78 58.17 23 105.69 68.49
  131.78H84.14C93 85 294.6 129.61 294.6 129.61`;

// Feature pills: [label, bgColor, borderColor, textColor]
const PILLS = [
  ['Local Engine',  'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.15)', '#ffffff'],
  ['Eval Bar',      'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.15)', '#ffffff'],
  ['Move Hints',    'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.15)', '#ffffff'],
  ['Configurable',  'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.15)', '#ffffff'],
];

// --- Layout ---

const ICON_SIZE = 128;             // Same as icon.svg (128x128)
const ICON_X = 50;                 // Left margin
const ICON_Y = (HEIGHT - ICON_SIZE) / 2; // Vertically centered
const TEXT_X = ICON_X + ICON_SIZE + 30;   // Text starts after icon + gap

const PILL_Y = 155;
const PILL_H = 26;
const PILL_R = 13;
const PILL_GAP = 10;
const PILL_PADDING = 20;

// --- Build SVG ---

// Estimate pill widths (roughly 7px per char + padding)
function pillWidth(label) {
  return label.length * 7 + PILL_PADDING * 2;
}

// Pills start aligned with title text
let pillsSvg = '';
let px = TEXT_X;
for (const [label, bg, border, color] of PILLS) {
  const w = pillWidth(label);
  pillsSvg += `
    <rect x="${px}" y="${PILL_Y}" width="${w}" height="${PILL_H}" rx="${PILL_R}"
          fill="${bg}" stroke="${border}" stroke-width="1"/>
    <text x="${px + w / 2}" y="${PILL_Y + 17}" text-anchor="middle"
          font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
          font-size="11" font-weight="600" fill="${color}">${label}</text>
  `;
  px += w + PILL_GAP;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#2c2c2e"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" rx="16" fill="url(#bg)"/>

  <!--
    Knight icon — uses the exact same transform as icon.svg (128x128).
    The path is in 512x512 space. The transform:
      1. translate(64,64)  — move origin to center of 128x128 box
      2. scale(-0.2, 0.2)  — flip horizontally + scale from 512 to ~102px
      3. translate(-240,-290) — offset to center the knight visually
  -->
  <g transform="translate(${ICON_X}, ${ICON_Y})">
    <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="22" fill="#ffffff" opacity="0.95"/>
    <g transform="translate(64, 64) scale(-0.2, 0.2) translate(-240, -290)">
      <path fill="#1a1a1a" d="${KNIGHT_PATH}"/>
    </g>
  </g>

  <!-- Title -->
  <text x="${TEXT_X}" y="90"
        font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
        font-size="48" font-weight="700" fill="#ffffff"
        letter-spacing="-1">Neural Knight</text>

  <!-- Subtitle -->
  <text x="${TEXT_X}" y="125"
        font-family="-apple-system, 'Segoe UI', system-ui, sans-serif"
        font-size="18" fill="#8e8e93">Real-time Stockfish analysis for Chess.com</text>

  <!-- Feature pills -->
  ${pillsSvg}
</svg>
`;

// --- Render ---

sharp(Buffer.from(svg), { density: 150 })
  .png()
  .toFile(OUTPUT)
  .then(() => console.log(`Banner saved to ${OUTPUT}`))
  .catch((err) => console.error('Error:', err));
