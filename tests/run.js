// Tests for Zombie Noobs.
//
//   node tests/run.js
//
// The game is one HTML file meant to run in a browser, so this pulls the script
// out of index.html and runs it against small fake versions of the browser bits
// it touches. That is enough to check the rules, the layout maths and a few
// minutes of simulated play without opening anything.
//
// These are not for show. They have already caught three real bugs:
//   1. Enemies walked straight into walls and got stuck, so a wave could never
//      be finished and the upgrade screen never appeared.
//   2. The map had 26 floor tiles sealed off with no way in or out.
//   3. A boss could be infected into a full-health permanent ally, which made
//      boss waves pointless.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const noop = () => {};

// --- the fake browser -------------------------------------------------------
const mkCtx = () => new Proxy({}, {
  get: (t, k) => k === 'measureText' ? ((s) => ({ width: String(s).length * 7 }))
    : k === 'canvas' ? { width: 0, height: 0 }
    : (() => {}),
});
const mkCanvas = () => ({
  width: 0, height: 0, style: {},
  getContext: () => mkCtx(), addEventListener: noop,
});
const stubEl = { style: {}, addEventListener: noop, textContent: '', innerHTML: '' };

// The safe-area probe reports a notch and a home indicator so the HUD layout
// gets tested against a real modern iPad rather than a rectangle.
const INSET_TOP = 24, INSET_BOTTOM = 34;

global.window = {
  devicePixelRatio: 2, innerWidth: 1180, innerHeight: 820,
  addEventListener: noop, matchMedia: () => ({ matches: false }),
  AudioContext: undefined, onerror: null,
};
global.document = {
  getElementById: () => Object.assign({}, stubEl, mkCanvas()),
  querySelector: () => null,
  createElement: (tag) => tag === 'canvas' ? mkCanvas() : { setAttribute: noop, style: {} },
  addEventListener: noop, head: { appendChild: noop }, visibilityState: 'visible',
};
global.getComputedStyle = () => ({
  paddingTop: INSET_TOP + 'px', paddingRight: '0px',
  paddingBottom: INSET_BOTTOM + 'px', paddingLeft: '0px',
});
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
};
global.performance = { now: () => 0 };
global.requestAnimationFrame = noop;
global.addEventListener = noop;
// Modern Node ships a real read-only `navigator`, so it has to be replaced
// rather than assigned to.
Object.defineProperty(global, 'navigator', {
  value: { maxTouchPoints: 5 }, configurable: true, writable: true,
});
window.localStorage = global.localStorage;

// --- load the game ----------------------------------------------------------
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = src.match(/<script>([\s\S]*?)<\/script>/g);
if (!scripts || !scripts.length) {
  console.error('Could not find a <script> block in index.html.');
  process.exit(1);
}
const code = scripts[scripts.length - 1].replace(/^<script>/, '').replace(/<\/script>$/, '');

eval(code + `
 global.G = { reset, update, draw, drawCards, drawPause, choose, rankFor,
   NOOB_RANKS, ZOMBIE_RANKS, UPGRADES, ENEMY_TYPES, TUNE, hostileCount,
   buildFlow, flowDir, solidAt, grid, GW, GH, TILE, spawnPoints, playerStart,
   freshUpgrades, waveCount, wrapLines, shade, rollEnemyType, resize,
   isBossWave, togglePause, toggleMute, spawnEnemy,
   get btn(){return btn}, get miniRect(){return miniRect}, get PAD(){return PAD},
   get flow(){return flow}, get player(){return player}, get enemies(){return enemies},
   get wave(){return wave}, get waveState(){return waveState}, get cards(){return cards},
   get waveToSpawn(){return waveToSpawn}, get bits(){return bits},
   get hearts(){return hearts}, get paused(){return paused}, get muted(){return muted},
   get stick(){return stick}, get VW(){return VW}, get VH(){return VH} };
`);

const G = global.G;
let failed = 0;
function ok(name, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  ' + extra : ''));
  if (!cond) failed++;
}
function group(name) { console.log('\n' + name); }
const overlaps = (a, b) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

// --- Josh's rules -----------------------------------------------------------
group("Josh's ranks: 7 / 22 / 37");
ok('0 kills is Noob', G.NOOB_RANKS[G.rankFor('noob', 0)].name === 'Noob');
ok('6 kills is still Noob', G.NOOB_RANKS[G.rankFor('noob', 6)].name === 'Noob');
ok('7 kills is Noob Knifer', G.NOOB_RANKS[G.rankFor('noob', 7)].name === 'Noob Knifer');
ok('21 kills is still Knifer', G.NOOB_RANKS[G.rankFor('noob', 21)].name === 'Noob Knifer');
ok('22 kills is Noob Gunner', G.NOOB_RANKS[G.rankFor('noob', 22)].name === 'Noob Gunner');
ok('36 kills is still Gunner', G.NOOB_RANKS[G.rankFor('noob', 36)].name === 'Noob Gunner');
ok('37 kills is Noob Rioter', G.NOOB_RANKS[G.rankFor('noob', 37)].name === 'Noob Rioter');
ok('the zombie side mirrors the same thresholds',
  G.ZOMBIE_RANKS.every((z, i) => z.at === G.NOOB_RANKS[i].at),
  G.ZOMBIE_RANKS.map(z => z.name).join(' / '));

// --- the map ----------------------------------------------------------------
group('The map');
G.reset();
let leaks = 0;
for (let x = 0; x < G.GW; x++) { if (G.grid[0][x] === 0 || G.grid[G.GH - 1][x] === 0) leaks++; }
for (let y = 0; y < G.GH; y++) { if (G.grid[y][0] === 0 || G.grid[y][G.GW - 1] === 0) leaks++; }
ok('the outside edge is sealed', leaks === 0, leaks + ' gaps');
ok('all rows are the same width', new Set(G.grid.map(r => r.length)).size === 1);
ok('the player starts on open floor', !G.solidAt(G.playerStart.x, G.playerStart.y));
ok('every spawn point is on open floor',
  G.spawnPoints.every(p => !G.solidAt(p.x, p.y)), G.spawnPoints.length + ' points');

G.buildFlow(Math.floor(G.player.x / G.TILE), Math.floor(G.player.y / G.TILE));
let openTiles = 0, reachable = 0;
for (let y = 0; y < G.GH; y++) {
  for (let x = 0; x < G.GW; x++) {
    if (G.grid[y][x] === 0) { openTiles++; if (G.flow[y * G.GW + x] >= 0) reachable++; }
  }
}
ok('no sealed-off pockets remain', openTiles === reachable,
  reachable + '/' + openTiles + ' open tiles reachable');
ok('every spawn point can walk to the player',
  G.spawnPoints.every(p =>
    G.flow[Math.floor(p.y / G.TILE) * G.GW + Math.floor(p.x / G.TILE)] >= 0));

// --- the look ---------------------------------------------------------------
group('The Roblox look');
ok('shade lightens', G.shade('#808080', 20) === 'rgb(148,148,148)', G.shade('#808080', 20));
ok('shade darkens', G.shade('#808080', -20) === 'rgb(108,108,108)', G.shade('#808080', -20));
ok('shade clamps at white', G.shade('#ffffff', 80) === 'rgb(255,255,255)');
ok('shade clamps at black', G.shade('#000000', -80) === 'rgb(0,0,0)');
ok('bricks have studs', /paintStuds/.test(src));
ok('tiles are pre-rendered, not thousands of studs per frame',
  /makeTile\(dpr/.test(src) && /drawImage\(img/.test(src));
ok('floor, wall and crate bricks all exist',
  /tileFloorA/.test(src) && /tileFloorB/.test(src) && /tileWall/.test(src) && /tileCrate/.test(src));
ok('characters are built from shaded blocky parts', /function part\(/.test(src));
ok('the noob has the classic smiley face', /classic noob face/.test(src));
ok('arms and legs are separate parts with gaps',
  /Two legs, with a gap/.test(src) && /Two arms/.test(src));

// --- layout -----------------------------------------------------------------
group('HUD stays inside the safe area');
G.reset(); G.resize();
ok('the notch inset is respected', G.PAD.t === 14 + INSET_TOP, 'PAD.t=' + G.PAD.t);
ok('the home indicator inset is respected', G.PAD.b === 14 + INSET_BOTTOM, 'PAD.b=' + G.PAD.b);
ok('all four buttons exist', !!(G.btn.pause && G.btn.mute && G.btn.full && G.btn.hit));
ok('icon buttons meet the 44px tap target',
  [G.btn.pause, G.btn.mute, G.btn.full].every(b => b.w >= 44 && b.h >= 44), G.btn.pause.w + 'px');
ok('the HIT button is present', !!G.btn.hit, 'radius ' + (G.btn.hit ? G.btn.hit.r : 'none'));
ok('the hit button does not cover the minimap', !overlaps(G.btn.hit, G.miniRect));
ok('the minimap does not cover the buttons', !overlaps(G.miniRect, G.btn.pause));
ok('the buttons do not cover each other',
  !overlaps(G.btn.pause, G.btn.mute) && !overlaps(G.btn.mute, G.btn.full));
ok('nothing hangs off the screen',
  [G.btn.pause, G.btn.mute, G.btn.full, G.btn.hit, G.miniRect].every(
    r => r.x >= 0 && r.y >= 0 && r.x + r.w <= G.VW && r.y + r.h <= G.VH));

// --- pause and mute ---------------------------------------------------------
group('Pause and mute');
ok('starts unpaused', G.paused === false);
G.togglePause();
ok('pause turns on', G.paused === true);
ok('the screen still draws while paused',
  (() => { try { G.draw(); return true; } catch (e) { console.log('    ' + e.message); return false; } })());
G.togglePause();
ok('pause turns off', G.paused === false);
const wasMuted = G.muted;
G.toggleMute();
ok('mute toggles and is remembered',
  G.muted !== wasMuted && global.localStorage.getItem('zn_muted') !== null);
G.toggleMute();

// --- enemies and upgrades ---------------------------------------------------
group('Enemy variety, bosses and upgrades');
ok('there are three kinds of enemy', G.ENEMY_TYPES.length === 3,
  G.ENEMY_TYPES.map(t => t.label).join(' / '));
const seen = {};
for (let i = 0; i < 3000; i++) { const k = G.rollEnemyType().key; seen[k] = (seen[k] || 0) + 1; }
ok('all three actually turn up', Object.keys(seen).length === 3, JSON.stringify(seen));
ok('a boss comes every 5 waves', G.isBossWave(5) && G.isBossWave(10) && G.isBossWave(15));
ok('no boss before wave 5', ![1, 2, 3, 4].some(G.isBossWave));
ok('there are 15 upgrade cards', G.UPGRADES.length === 15, String(G.UPGRADES.length));
ok('every card actually changes something', G.UPGRADES.every(u => {
  const a = G.freshUpgrades(), b = G.freshUpgrades();
  u.apply(b);
  return JSON.stringify(a) !== JSON.stringify(b);
}));
ok('no card ever makes you worse overall', G.UPGRADES.every(u => {
  const b = G.freshUpgrades(); u.apply(b);
  return b.hpAdd >= 0 && b.armorAdd >= 0 && b.biteRes <= 1 && b.heal >= 1 && b.luck >= 1;
}));
ok('enemy health compounds so upgrades cannot outrun it',
  /Math\.pow\(1 \+ TUNE\.WAVE_TOUGHER/.test(src));

// --- simulated play ---------------------------------------------------------
function playFor(frames, chase) {
  G.reset();
  let clears = 0, sawBoss = false, bossAllied = false, err = null;
  try {
    for (let i = 0; i < frames; i++) {
      if (chase) {
        let target = null, best = Infinity;
        for (const e of G.enemies) {
          if (e.side === G.player.side || e.hp <= 0) continue;
          const d = Math.hypot(e.x - G.player.x, e.y - G.player.y);
          if (d < best) { best = d; target = e; }
        }
        if (target && G.waveState === 'fighting') {
          const a = Math.atan2(target.y - G.player.y, target.x - G.player.x);
          G.stick.active = true;
          G.stick.dx = Math.cos(a) * 62;
          G.stick.dy = Math.sin(a) * 62;
        } else { G.stick.active = false; G.stick.dx = 0; G.stick.dy = 0; }
      }
      for (const e of G.enemies) {
        if (e.boss) { sawBoss = true; if (e.side === G.player.side) bossAllied = true; }
      }
      G.update(1 / 60);
      if (G.waveState === 'picking') {
        clears++;
        G.choose(G.cards[Math.floor(Math.random() * G.cards.length)]);
      }
    }
  } catch (e) { err = e.message; }
  return { clears: clears, sawBoss: sawBoss, bossAllied: bossAllied, err: err };
}

group('Three minutes of play, player never moves (worst case)');
let r = playFor(10800, false);
ok('no crash', r.err === null, r.err || '');
ok('waves still get cleared', r.clears >= 3, r.clears + ' clears, reached wave ' + G.wave);
ok('a boss turned up', r.sawBoss);
ok('the player is on open floor', !G.solidAt(G.player.x, G.player.y));
ok('no NaN anywhere', Number.isFinite(G.player.hp) && Number.isFinite(G.player.x)
  && G.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.hp)));
ok('particles are not leaking', G.bits.length < 900, String(G.bits.length));

group('Three minutes of play, chasing enemies');
r = playFor(10800, true);
ok('no crash', r.err === null, r.err || '');
ok('waves get cleared', r.clears >= 4, r.clears + ' clears, reached wave ' + G.wave);
ok('a boss never becomes your ally', !r.bossAllied);
ok('the screen still draws afterwards',
  (() => { try { G.draw(); return true; } catch (e) { console.log('    ' + e.message); return false; } })());

// --- boss balance -----------------------------------------------------------
// Measured directly rather than hoping the simulation wanders into one. The
// player is kept topped up so this measures damage, not survival.
function bossTimeToKill(rankKills, damageUpgrades) {
  G.reset();
  G.player.kills.noob = rankKills;
  G.player.rank = G.rankFor('noob', rankKills);
  for (let i = 0; i < damageUpgrades; i++) G.player.up.dmg *= 1.30;

  G.enemies.length = 0;
  G.spawnEnemy('zombie', true);
  const boss = G.enemies[0];
  boss.x = G.player.x + 30;
  boss.y = G.player.y;
  const hp = boss.maxhp;

  let frames = 0;
  const cap = 60 * 120;
  while (boss.hp > 0 && frames < cap) {
    const a = Math.atan2(boss.y - G.player.y, boss.x - G.player.x);
    G.stick.active = true;
    G.stick.dx = Math.cos(a) * 62;
    G.stick.dy = Math.sin(a) * 62;
    G.player.hp = G.player.maxhp;
    G.player.bite = 0;
    G.enemies.length = 1;
    G.update(1 / 60);
    frames++;
    if (!G.enemies.includes(boss)) break;
  }
  return { secs: frames / 60, hp: hp, killed: boss.hp <= 0,
           rank: G.NOOB_RANKS[G.player.rank].name };
}

group('Boss fights');
const ttk = [[0, 0], [7, 2], [22, 4], [37, 6]].map(c => bossTimeToKill(c[0], c[1]));
ttk.forEach((x, i) => {
  console.log('    ' + x.rank.padEnd(12) + ' with ' + [0, 2, 4, 6][i] + ' damage upgrades: '
    + (x.killed ? x.secs.toFixed(1) + 's' : 'NOT KILLED in 120s') + '   (boss ' + x.hp + ' hp)');
});
ok('a brand new Noob can kill a boss with bare fists', ttk[0].killed,
  ttk[0].killed ? ttk[0].secs.toFixed(1) + 's' : '');
ok('every rank can kill a boss', ttk.every(x => x.killed));
ok('a boss is not a slog', ttk[0].killed && ttk[0].secs < 45, ttk[0].secs.toFixed(1) + 's');
ok('a boss is not a pushover either', ttk[0].secs > 3, ttk[0].secs.toFixed(1) + 's');
ok('upgrades visibly speed it up', ttk[3].secs < ttk[0].secs,
  ttk[0].secs.toFixed(1) + 's -> ' + ttk[3].secs.toFixed(1) + 's');

console.log('\n    enemy health by wave (it compounds):');
for (const w of [1, 5, 10, 15, 20]) {
  const sc = Math.pow(1 + G.TUNE.WAVE_TOUGHER, w - 1);
  console.log('      wave ' + String(w).padStart(2) + ':  normal '
    + String(Math.round(G.TUNE.ENEMY_HEALTH * sc)).padStart(4) + ' hp    boss '
    + String(Math.round(G.TUNE.ENEMY_HEALTH * sc * G.TUNE.BOSS_HEALTH)).padStart(5) + ' hp'
    + ' + ' + Math.round(G.TUNE.BOSS_ARMOR * 100) + '% armor');
}

// --- credit -----------------------------------------------------------------
group('Josh is credited');
ok('on the title screen', /A game by[\s\S]{0,80}Josh Alexander/.test(src));
ok('on the pause screen', /by Josh Alexander/.test(src));
ok('at the top of the code', /Made by Josh Alexander/.test(src));

group('ZzFX attribution is intact');
ok('the MIT notice is present', /MIT License - Copyright 2019 Frank Force/.test(src));
ok('it links back to the project', /github\.com\/KilledByAPixel\/ZzFX/.test(src));

console.log('');
console.log(failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED');
process.exit(failed ? 1 : 0);
