// =====================================================================================
//  Promo example: the smallest complete promo adapter, filming the mini-arena example game.
//  Kits come from the Studio; outputs land in this project's out.promo folder.
//
//  Console (http://localhost:<port>/__studio/examples/promo/):
//    await promo.still(4)                                  // -> promo/out/still.jpg
//    await promo.sheet()                                   // -> promo/out/sheet.jpg
//    promo.start({ name: 'mini-arena-promo.mp4' }); promo.job   // full render (poll job)
//    await verify('mini-arena-promo.mp4')                  // -> promo/out/mini-arena-promo-check.jpg
// =====================================================================================
import { createRenderer } from '/__studio/kits/promo/renderer.js';
import { createMotion } from '/__studio/kits/promo/motion.js';
import { renderSoundtrack } from '/__studio/kits/promo/soundtrack.js';
import { inspectMp4 } from '/__studio/kits/promo/verify.js';
import { Game } from '/__studio/examples/mini-arena/game.js';

const W = 1920, H = 1080, DURATION = 6;

// ---- boot: construct the game ourselves, no main loop ---------------------------------
const arena = document.getElementById('arena');
const game = new Game(arena);
game.ui.showUpgrade = (opts, pick) => pick(opts[0]);   // a promo never stops for a choice
window.game = game;

// ---- staging API ------------------------------------------------------------------------
export const P = {
  game,
  // A fresh deterministic scenario, warmed up so the shot opens mid-action.
  stage(seed, warm = 0) {
    window.__promo.seed(seed);
    game.start();
    for (let i = 0; i < warm * 30; i++) { window.__promo.advance(1000 / 30); tickGame(1 / 30); }
  },
  shot: null,
};
window.P = P;

// The hero circles the arena and shoots the nearest enemy; it can't die on camera.
function tickGame(dt) {
  const p = game.p, inp = game.input;
  const a = performance.now() / 1000;   // virtual clock (shims.js)
  inp.bot = true; inp.moveX = Math.cos(a); inp.moveY = Math.sin(a);
  const e = game.enemies.reduce((best, e) => (!best || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? e : best), null);
  inp.fire = !!e;
  if (e) { inp.aimX = e.x; inp.aimY = e.y; }
  p.inv = 1;
  game.update(dt);
}

// The game is 4:3; letterbox it onto a 16:9 plate.
const plate = Object.assign(document.createElement('canvas'), { width: W, height: H });
function render() {
  game.render();
  const g = plate.getContext('2d');
  g.fillStyle = '#101814'; g.fillRect(0, 0, W, H);
  g.drawImage(arena, (W - 1440) / 2, 0, 1440, H);
}

// ---- shots, titles, soundtrack ------------------------------------------------------------
const SHOTS = [
  { id: 'open', t0: 0, setup: (P) => P.stage(1, 2) },
  { id: 'horde', t0: 3, setup: (P) => P.stage(7, 25), zoomPost: (t) => 1 + 0.03 * t },
];
const CUTS = [{ t: 3, punch: 0.06, flash: 0.5 }];
const M = createMotion({ W, H });
function drawTitles(g, { T }) {
  if (T < 3) M.wordmark(g, T, { text: 'MINI ARENA', y: 500, size: 180, exit: 2.6, tagline: 'SURVIVE 90 SECONDS', tagAt: 0.5 });
  else M.featureTitle(g, T - 3, 2.5, { num: '01', label: 'TOP-DOWN SURVIVAL', l1: 'DODGE', l2: 'THE HORDE', accent: '#4fc3f7' });
}
const CUE = { bpm: 120, intro: { end: 1 }, groove: { from: 1, to: 5 }, cuts: [{ t: 3, kind: 'major' }], outro: { at: 5, chord: 'Am' } };

// ---- renderer ---------------------------------------------------------------------------
window.promo = createRenderer({
  width: W, height: H, fps: 60, duration: DURATION,
  canvas: document.getElementById('comp'),
  source: () => plate,
  shots: SHOTS,
  tick: tickGame,
  render,
  titles: drawTitles,
  cuts: CUTS,
  soundtrack: (duration) => renderSoundtrack({ ...CUE, duration }),
  context: P,
});

// The store verifier: reads the MP4 back and saves a check grid next to it.
window.verify = (file = 'mini-arena-promo.mp4') => inspectMp4(window.promo.put, file, { times: [0, 1.5, 3, 4.5, 5.9], fps: 60 });
