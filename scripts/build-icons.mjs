// Génère le logo de Manne — « la Parole lumière » : un livre ouvert doré d'où rayonne la lumière
// (« En elle était la vie, et la vie était la lumière des hommes », Jean 1:4) — et toutes ses déclinaisons.
// Usage : node scripts/build-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = ['#1a1c25', '#0d0e12'];
const GOLD = ['#ffe29a', '#f2b544', '#d48f22'];

/** Les rayons partent du haut de la reliure, en éventail ; le rayon central est le plus long. */
function rays(color) {
  return [-70, -46, -23, 0, 23, 46, 70]
    .map((a, i) => {
      const center = i === 3;
      const r2 = center ? 330 : i === 2 || i === 4 ? 300 : 270;
      const rad = (a * Math.PI) / 180;
      const x = (r) => (512 + r * Math.sin(rad)).toFixed(1);
      const y = (r) => (560 - r * Math.cos(rad)).toFixed(1);
      return `<line x1="${x(120)}" y1="${y(120)}" x2="${x(r2)}" y2="${y(r2)}" stroke="${color}" stroke-width="${center ? 26 : 18}" stroke-linecap="round" opacity="${center ? 1 : 0.8}"/>`;
    })
    .join('');
}

/**
 * @param {object} o
 * @param {boolean} [o.background] fond nuit plein (icône iOS) ou transparent
 * @param {number} [o.scale] réduction du motif (zone de sécurité des icônes adaptatives Android)
 * @param {boolean} [o.mono] version monochrome (icône thémée Android 13+)
 */
function logo({ background = false, scale = 1, mono = false } = {}) {
  const fill = mono ? '#ffffff' : 'url(#gold)';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG[0]}"/><stop offset="1" stop-color="${BG[1]}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD[0]}"/><stop offset="0.45" stop-color="${GOLD[1]}"/><stop offset="1" stop-color="${GOLD[2]}"/></linearGradient>
    <!-- en coordonnées absolues : un dégradé relatif ne s'applique pas à une ligne parfaitement verticale -->
    <linearGradient id="ray" gradientUnits="userSpaceOnUse" x1="0" y1="230" x2="0" y2="460"><stop offset="0" stop-color="${GOLD[0]}"/><stop offset="1" stop-color="${GOLD[1]}"/></linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd166" stop-opacity="0.5"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
  </defs>
  ${background ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -521)">
    ${mono ? '' : '<circle cx="512" cy="480" r="300" fill="url(#halo)"/>'}
    ${rays(mono ? '#ffffff' : 'url(#ray)')}
    <!-- Livre ouvert -->
    <g transform="translate(512 700) scale(0.9) translate(-512 -640)">
      <path d="M496 544 C428 494 328 484 228 512 L228 734 C328 708 428 716 496 766 Z" fill="${fill}"/>
      <path d="M528 544 C596 494 696 484 796 512 L796 734 C696 708 596 716 528 766 Z" fill="${fill}"/>
      ${mono ? '' : `<g fill="none" stroke="#a86a14" stroke-width="9" stroke-linecap="round" opacity="0.45">
        <path d="M282 574 C352 556 424 562 468 588"/><path d="M282 622 C352 604 424 610 468 636"/><path d="M282 670 C352 652 424 658 468 684"/>
        <path d="M742 574 C672 556 600 562 556 588"/><path d="M742 622 C672 604 600 610 556 636"/><path d="M742 670 C672 652 600 658 556 684"/>
      </g>`}
    </g>
  </g>
</svg>`;
}

function render(svg, file, size = 1024) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(`../assets/${file}`, import.meta.url), png);
  console.log(`assets/${file} (${size}px)`);
}

mkdirSync(new URL('../assets/logo/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/logo/manne.svg', import.meta.url), logo({ background: true }));

render(logo({ background: true }), 'icon.png'); // iOS (coins arrondis par le système)
render(logo({ scale: 0.78 }), 'android-icon-foreground.png'); // reste dans la zone sûre des masques ronds
render(logo({ scale: 0.78, mono: true }), 'android-icon-monochrome.png');
render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG[0]}"/><stop offset="1" stop-color="${BG[1]}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>`, 'android-icon-background.png');
render(logo(), 'splash-icon.png'); // motif seul, sur le fond du splash
render(logo({ background: true }), 'favicon.png', 48);
render(logo({ scale: 1.55, mono: true }), 'notification-icon.png', 96); // barre de notifications Android : blanc sur transparent
