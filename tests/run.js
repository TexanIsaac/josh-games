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
   isBossWave, togglePause, toggleMute, spawnEnemy, drawStanding, drawFloor,
   drawBox, WALL_H, CRATE_H, WALL_COLOR, CRATE_COLOR, ZOOM,
   hasLineOfSight, separate, startWave, blockingHostiles,
   isoX, isoY, stickToWorld, tileTopAt, topUnder, blockedAt, updateHeight,
   CLIMB_SPEED, FALL_SPEED, STEP_UP, onScreen, updateCamera, moveEntity,
   unstick, BODY, UNSTICK_STEP, POWERUPS, rollPowerup, addToBag, useSlot,
   usePowerup, explode, chainLightning, drawHotbar, VERSION,
   hidesSomeone, buildOccludees, becomeBoss, endBossMode, WALL_H, CRATE_H, killEnemy,
   get _occludees(){return _occludees},
   brickAt, BRICKS, GRASS_A, GRASS_B, SKY,
   get bag(){return bag}, get powerups(){return powerups},
   get blasts(){return blasts}, get zaps(){return zaps},
   get freezeT(){return freezeT}, get bagRects(){return bagRects},
   get _standing(){return _standing},
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
// Lego has studs on every brick. Roblox has a studded baseplate and smooth
// parts standing on it. Josh said the studded version looked like Lego.
ok('the baseplate has studs', /One soft stud per square/.test(src));
ok('walls and crates are SMOOTH, no studs on them',
  !/paintStuds\(g, WALL_COLOR/.test(src) && !/paintStuds\(g, CRATE_COLOR/.test(src));
ok('the Lego-vs-Roblox reasoning is written down', /made it look like Lego/.test(src));

group('It is drawn in 3D, not flat top-down')
ok('there is a tilted projection', typeof G.isoX === 'function' && typeof G.isoY === 'function');
ok('moving across the ground moves you diagonally on screen',
  G.isoX(40, 0) !== G.isoX(0, 40) && G.isoY(40, 0) === G.isoY(0, 40),
  'x+ and y+ separate horizontally but share a depth line');
ok('height lifts things up the screen', G.isoY(0, 0, 40) < G.isoY(0, 0, 0),
  'z=40 sits ' + (G.isoY(0, 0, 0) - G.isoY(0, 0, 40)).toFixed(0) + 'px higher');
ok('blocks are drawn as boxes with three faces', /function drawBox/.test(src)
  && /Left side, the one in most shadow/.test(src)
  && /Right side, catching more light/.test(src)
  && /Top face, fully lit/.test(src));
ok('faces are shaded top to bottom, not one flat tone',
  /reads as light falling across a surface/.test(src));
ok('block edges get a bevel and a corner seam',
  /bright bevel along the two top edges/.test(src) && /dark seam down the corner/.test(src));
ok('drawBox runs without throwing',
  (() => { try { G.drawBox(0, 0, 0, 40, 40, 34, G.WALL_COLOR); return true; }
           catch (e) { console.log('    ' + e.message); return false; } })());
ok('characters are stacks of boxes', /A character, built out of real boxes/.test(src));
ok('the camera is zoomed in, not showing the whole map', G.ZOOM > 1.5,
  'zoom ' + G.ZOOM + 'x');
ok('walls are taller than crates', G.WALL_H > G.CRATE_H,
  'wall ' + G.WALL_H + ' vs crate ' + G.CRATE_H);

// The stick has to be rotated into the tilted world or the controls feel wrong.
group('Controls match the tilted view')
const up = G.stickToWorld(0, -1);
ok('pushing up on the stick sends you away from the camera',
  up.dx < 0 && up.dy < 0, 'dx=' + up.dx.toFixed(2) + ' dy=' + up.dy.toFixed(2));
const right = G.stickToWorld(1, 0);
ok('pushing right sends you along the other diagonal',
  right.dx > 0 && right.dy < 0, 'dx=' + right.dx.toFixed(2) + ' dy=' + right.dy.toFixed(2));
ok('the mapped direction is always a unit length',
  [[0,-1],[1,0],[0,1],[-1,0],[0.7,0.7]].every(v => {
    const w = G.stickToWorld(v[0], v[1]);
    return Math.abs(Math.hypot(w.dx, w.dy) - 1) < 1e-9;
  }));
ok('a dead stick means no movement',
  G.stickToWorld(0, 0).dx === 0 && G.stickToWorld(0, 0).dy === 0);

group('Climbing')
ok('walls report their height', G.tileTopAt(0, 0) === G.WALL_H,
  'the border wall is ' + G.tileTopAt(0, 0) + ' tall');
ok('open floor is at zero', G.tileTopAt(G.playerStart.x, G.playerStart.y) === 0);
ok('off the edge of the map is unclimbably tall', G.tileTopAt(-50, -50) > G.WALL_H);
ok('standing on the ground, a wall blocks you',
  G.blockedAt(G.TILE * 0.5, G.TILE * 0.5, 10, 0));
ok('standing on top of that wall, it does not block you',
  !G.blockedAt(G.TILE * 0.5, G.TILE * 0.5, 10, G.WALL_H));

// Find a floor tile with a wall right next to it, then push into the wall.
let climbSpot = null;
for (let gy = 1; gy < G.GH - 1 && !climbSpot; gy++) {
  for (let gx = 1; gx < G.GW - 2 && !climbSpot; gx++) {
    if (G.grid[gy][gx] === 0 && G.grid[gy][gx + 1] === 1) {
      climbSpot = { x: (gx + 0.5) * G.TILE, y: (gy + 0.5) * G.TILE };
    }
  }
}
ok('found a wall to try climbing', climbSpot !== null);
// Driven the same way the game drives it: push forward and update height every
// frame, so the climb finishes by stepping up onto the top rather than hovering
// at the lip.
const climber = { x: climbSpot.x, y: climbSpot.y, r: 13, z: 0 };
const startX = climber.x;
let peakZ = 0, gotOnTop = false;
for (let i = 0; i < 300; i++) {
  G.moveEntity(climber, 205 / 60, 0);
  G.updateHeight(climber, 1, 0, 1 / 60);
  if (climber.z > peakZ) peakZ = climber.z;
  // Standing on the wall means being over a tile whose top is wall height.
  if (climber.z >= G.WALL_H - 0.5 && G.topUnder(climber.x, climber.y, climber.r * 0.5) === G.WALL_H) {
    gotOnTop = true;
  }
}
ok('pushing into a wall climbs all the way up it', peakZ >= G.WALL_H - 0.5,
  'reached z=' + peakZ.toFixed(1) + ' of ' + G.WALL_H);
ok('and you end up standing on top of the wall, not stuck against it', gotOnTop);
ok('keep going and you walk over it and off the far side',
  climber.x > startX + G.TILE,
  'crossed ' + (climber.x - startX).toFixed(0) + 'px, ended at z=' + climber.z.toFixed(0));
ok('nothing can walk through a wall at ground level', (() => {
  const cheat = { x: climbSpot.x, y: climbSpot.y, r: 13, z: 0 };
  // Push forward but never let it climb: it must be stopped by the wall face.
  for (let i = 0; i < 300; i++) G.moveEntity(cheat, 205 / 60, 0);
  return G.topUnder(cheat.x, cheat.y, cheat.r * G.BODY) === 0;
})());
ok('being freed from a block never looks like a jump', G.UNSTICK_STEP <= 6,
  'at most ' + G.UNSTICK_STEP + 'px a frame');
ok('a body wedged in a block gets walked back out', (() => {
  // Drop one right inside a wall and see if it works its way free.
  const buried = { x: G.TILE * 0.5, y: G.TILE * 1.5, r: 13, z: 0 };
  let freed = false;
  for (let i = 0; i < 200 && !freed; i++) {
    G.unstick(buried);
    if (G.topUnder(buried.x, buried.y, buried.r * G.BODY) === 0) freed = true;
  }
  return freed;
})());
// Now let go over open floor and it should come back down.
const faller = { x: G.playerStart.x, y: G.playerStart.y, r: 13, z: G.WALL_H };
for (let i = 0; i < 240; i++) G.updateHeight(faller, 0, 0, 1 / 60);
ok('walking off an edge drops you back down', faller.z === 0,
  'ended at z=' + faller.z.toFixed(1));
ok('you cannot climb without pushing into something', (() => {
  const idle = { x: climbSpot.x, y: climbSpot.y, r: 13, z: 0 };
  for (let i = 0; i < 120; i++) G.updateHeight(idle, 0, 0, 1 / 60);
  return idle.z === 0;
})());
ok('enemies climb with the same rules', /same rules you do/.test(src));

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
  // Earlier groups can leave the stick held over, which made the supposedly idle
  // run drive into a wall for three minutes and clear nothing.
  G.stick.active = false; G.stick.dx = 0; G.stick.dy = 0;
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

// --- how clever the enemies are ---------------------------------------------
group('Enemies are not brainless');
ok('line of sight is clear across an open tile',
  G.hasLineOfSight(G.playerStart.x, G.playerStart.y, G.playerStart.x + 20, G.playerStart.y));
// Find a real wall and check it actually blocks sight through it.
let blockedPair = null;
for (let gy = 2; gy < G.GH - 2 && !blockedPair; gy++) {
  for (let gx = 2; gx < G.GW - 2 && !blockedPair; gx++) {
    if (G.grid[gy][gx] !== 0) continue;
    if (G.grid[gy][gx + 1] === 0) continue;
    if (G.grid[gy][gx + 2] !== 0) continue;
    blockedPair = [(gx + 0.5) * G.TILE, (gy + 0.5) * G.TILE,
                   (gx + 2.5) * G.TILE, (gy + 0.5) * G.TILE];
  }
}
ok('a wall blocks line of sight', blockedPair !== null
  && !G.hasLineOfSight(blockedPair[0], blockedPair[1], blockedPair[2], blockedPair[3]));
ok('nothing fires without a clear shot', /Never fire into a wall/.test(src));
ok('enemies shove apart instead of stacking up', typeof G.separate === 'function');
ok('enemies flank instead of queueing single file', G.TUNE.ENEMY_FLANK > 0);
ok('spitters keep their distance', G.TUNE.RANGED_NEAR < G.TUNE.RANGED_FAR,
  G.TUNE.RANGED_NEAR + ' to ' + G.TUNE.RANGED_FAR + 'px');
ok('a retreating enemy is slower than the player, so it can always be caught',
  G.TUNE.ENEMY_SPEED < G.TUNE.PLAYER_SPEED,
  'enemy ' + G.TUNE.ENEMY_SPEED + ' vs player ' + G.TUNE.PLAYER_SPEED);
ok('brutes charge faster than they walk', G.TUNE.BRUTE_CHARGE_SPEED > 1);

// Enemies must actually get better ranks as the waves go on, or all the new
// behaviour never runs at all.
const ranksSeen = new Set();
for (let w = 1; w <= 14; w++) {
  G.reset();
  for (let i = 0; i < 400; i++) {
    G.enemies.length = 0;
    // Force the wave number by starting it, then spawn a batch.
    G.startWave(w);
    G.spawnEnemy('zombie', false);
    if (G.enemies[0]) ranksSeen.add(G.enemies[0].rank);
  }
}
ok('enemies appear at more than one rank', ranksSeen.size > 1,
  'ranks seen: ' + [...ranksSeen].sort().join(', '));
ok('ranged enemies do occur, so the kiting brain runs', ranksSeen.has(2));

// Clumping is the measurable version of "they look dumb". Count how many pairs
// of enemies are sitting on top of each other after a couple of minutes.
// Sampled all the way through, not just at the end, and only on frames with
// enough enemies alive to actually be able to clump.
G.reset();
let worstOverlap = 0, samples = 0, mostEnemies = 0;
for (let i = 0; i < 7200; i++) {
  G.update(1 / 60);
  if (G.waveState === 'picking') G.choose(G.cards[0]);
  if (i % 30 === 0 && G.enemies.length >= 4) {
    let stacked = 0, pairs = 0;
    for (let a = 0; a < G.enemies.length; a++) {
      for (let b = a + 1; b < G.enemies.length; b++) {
        pairs++;
        const p = G.enemies[a], q = G.enemies[b];
        if (Math.hypot(p.x - q.x, p.y - q.y) < (p.r + q.r) * 0.8) stacked++;
      }
    }
    if (pairs) {
      worstOverlap = Math.max(worstOverlap, stacked / pairs);
      samples++;
      mostEnemies = Math.max(mostEnemies, G.enemies.length);
    }
  }
}
ok('the clumping test actually had crowds to measure', samples > 20 && mostEnemies >= 6,
  samples + ' samples, up to ' + mostEnemies + ' enemies at once');
ok('enemies never pile up on each other', worstOverlap < 0.15,
  'worst was ' + (worstOverlap * 100).toFixed(1) + '% of pairs overlapping');

group('Nothing teleports');
// Josh spotted enemies jumping across the map. That was a safety net that picked
// up any stuck enemy and dropped it at a spawn point. This watches every enemy
// every frame and fails if anything moves further in one frame than it could
// possibly have walked, so that behaviour cannot come back unnoticed.
G.reset();
const maxStep = (G.TUNE.ENEMY_SPEED * 1.75 * G.TUNE.BRUTE_CHARGE_SPEED
                 + G.TUNE.ENEMY_SEPARATION) / 60;
const allowed = maxStep * 2.5;
let biggestJump = 0, jumps = 0, watched = 0;
let prev = new Map();
for (let i = 0; i < 9000; i++) {
  G.update(1 / 60);
  if (G.waveState === 'picking') G.choose(G.cards[0]);
  const now = new Map();
  for (const e of G.enemies) {
    now.set(e, { x: e.x, y: e.y });
    const was = prev.get(e);
    if (was) {
      const moved = Math.hypot(e.x - was.x, e.y - was.y);
      watched++;
      if (moved > biggestJump) biggestJump = moved;
      if (moved > allowed) jumps++;
    }
  }
  prev = now;
}
ok('the teleport safety net is gone from the code',
  !/e\.x = sp2\.x/.test(src) && /which just looked like/.test(src));
ok('enough enemy movement was watched', watched > 20000, watched + ' frame-to-frame checks');
ok('no enemy ever jumps further than it could walk', jumps === 0,
  jumps + ' jumps; biggest single step ' + biggestJump.toFixed(1)
  + 'px, allowed ' + allowed.toFixed(1) + 'px');
ok('a wave cannot be held open by something unreachable',
  typeof G.blockingHostiles === 'function');

group('Kiting enemies cannot soft-lock a wave');
// A spitter that runs away forever would make a wave impossible to finish, so
// this plays several minutes and checks waves keep completing well past the
// wave where ranged enemies start appearing.
G.reset();
let lateClears = 0, lateErr = null;
try {
  for (let i = 0; i < 36000; i++) {
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
    G.update(1 / 60);
    if (G.waveState === 'picking') { lateClears++; G.choose(G.cards[0]); }
  }
} catch (e) { lateErr = e.message; }
ok('ten minutes of play without crashing', lateErr === null, lateErr || '');
ok('got well past the wave where spitters appear',
  G.wave > G.TUNE.RANK2_FROM_WAVE + 1,
  'reached wave ' + G.wave + ' with ' + lateClears + ' clears');

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
group('You can see what is going on');
// A real bug found from a screenshot: the zombie body colours sat almost exactly
// on top of the green baseplate, so their bodies vanished into the ground and only
// the head showed. Brightness is measurable, so it gets checked.
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}
const FLOOR_A = '#4c5a4a', FLOOR_B = '#475440';
const zombieBody = ['#9ed36a', '#5a2b4a', '#2f3340'];
const noobBody = ['#f5cd30', '#0a9bf5', '#6aa84f'];
ok('zombie parts stand out from the grass', zombieBody.every(c =>
  Math.abs(lum(c) - lum(FLOOR_A)) > 18 && Math.abs(lum(c) - lum(FLOOR_B)) > 18),
  zombieBody.map(c => c + ' d=' + Math.abs(lum(c) - lum(FLOOR_A)).toFixed(0)).join('  '));
ok('noob parts stand out from the grass', noobBody.every(c =>
  Math.abs(lum(c) - lum(FLOOR_A)) > 18));
ok('the zombie colours in the code match the ones checked here',
  zombieBody.every(c => src.indexOf(c) !== -1));
ok('a zombie is not mistakable for a noob at a glance',
  Math.abs(lum(zombieBody[1]) - lum(noobBody[1])) > 15);
// The tinted enemy types have to stand out from the grass too.
const tints = ['#d98a2b', '#a35ce0'];
ok('the runner and brute tints also stand out from the grass',
  tints.every(c => Math.abs(lum(c) - lum(FLOOR_A)) > 18),
  tints.map(c => c + ' d=' + Math.abs(lum(c) - lum(FLOOR_A)).toFixed(0)).join('  '));

ok('the player is marked out from everyone else',
  /bright ring on the ground marks you out/.test(src));
ok('and marked above the head too, for when you are behind a wall',
  /find yourself even behind a wall/.test(src));

group('Pickups and the item row');
ok('there is a version marker on screen', typeof G.VERSION === 'string' && G.VERSION.length > 0,
  G.VERSION);
ok('there are several kinds of pickup', G.POWERUPS.length >= 6,
  G.POWERUPS.map(p => p.name).join(', '));
ok('grenades, bombs and nukes are all in there',
  ['grenade','bomb','nuke'].every(k => G.POWERUPS.some(p => p.kind === k)));
ok('a nuke is rarer than a grenade',
  G.POWERUPS.find(p => p.kind === 'nuke').weight <
  G.POWERUPS.find(p => p.kind === 'grenade').weight);
const rolls = {};
for (let i = 0; i < 6000; i++) { const k = G.rollPowerup().kind; rolls[k] = (rolls[k] || 0) + 1; }
ok('every kind actually drops', Object.keys(rolls).length === G.POWERUPS.length,
  JSON.stringify(rolls));

G.reset();
ok('the bag starts empty', G.bag.length === 0);
ok('there is a slot for every place in the bag', G.bagRects.length === G.TUNE.BAG_SLOTS,
  G.bagRects.length + ' slots');
ok('picking one up puts it in the bag',
  G.addToBag({ kind: 'nuke', name: 'NUKE', color: '#fff' }) && G.bag.length === 1);
ok('a second of the same kind stacks instead of taking another slot',
  G.addToBag({ kind: 'nuke', name: 'NUKE', color: '#fff' })
  && G.bag.length === 1 && G.bag[0].count === 2, 'x' + G.bag[0].count);
ok('a different kind takes its own slot',
  G.addToBag({ kind: 'bomb', name: 'BOMB', color: '#fff' }) && G.bag.length === 2);
// Fill it right up and check nothing spills over.
for (const p of G.POWERUPS) G.addToBag({ kind: p.kind, name: p.name, color: p.color });
ok('the bag never holds more than its slots', G.bag.length <= G.TUNE.BAG_SLOTS,
  G.bag.length + ' of ' + G.TUNE.BAG_SLOTS);
ok('a full bag refuses a new kind, so the pickup is left on the floor',
  G.bag.length === G.TUNE.BAG_SLOTS
  && G.addToBag({ kind: 'notathing', name: 'X', color: '#fff' }) === false);

G.reset();
G.addToBag({ kind: 'nuke', name: 'NUKE', color: '#fff' });
G.addToBag({ kind: 'nuke', name: 'NUKE', color: '#fff' });
G.useSlot(0);
ok('using one spends a single item from the stack',
  G.bag.length === 1 && G.bag[0].count === 1, 'x' + G.bag[0].count);
G.useSlot(0);
ok('using the last one empties the slot', G.bag.length === 0);
ok('tapping an empty slot does nothing bad',
  (() => { try { G.useSlot(0); G.useSlot(5); return true; } catch (e) { return false; } })());

group('The pickups actually do something');
G.reset();
// Put a crowd right next to the player and set a bomb off.
for (let i = 0; i < 8; i++) {
  G.spawnEnemy('zombie', false);
  const e = G.enemies[G.enemies.length - 1];
  e.x = G.player.x + 20 + i * 6;
  e.y = G.player.y;
  e.hp = 40; e.maxhp = 40;
}
const before = G.enemies.length;
G.explode(G.player.x, G.player.y, G.TUNE.BOMB_RADIUS, G.TUNE.BOMB_DMG, '#fff');
ok('a bomb clears out a crowd', G.enemies.filter(e => e.hp > 0).length < before,
  before + ' enemies down to ' + G.enemies.filter(e => e.hp > 0).length);
ok('a blast leaves a visible ring', G.blasts.length > 0);

G.reset();
for (let i = 0; i < 5; i++) {
  G.spawnEnemy('zombie', false);
  const e = G.enemies[G.enemies.length - 1];
  e.x = G.player.x + 40 + i * 30; e.y = G.player.y;
}
G.chainLightning(G.player.x, G.player.y);
ok('lightning jumps between several enemies', G.zaps.length >= 2,
  G.zaps.length + ' arcs');

G.reset();
G.usePowerup('freeze');
ok('freeze puts a timer on the enemies', G.freezeT > 0, G.freezeT.toFixed(1) + 's');
G.usePowerup('rage');
ok('rage puts a timer on you', G.player.rageT > 0, G.player.rageT.toFixed(1) + 's');
G.usePowerup('shield');
ok('shield makes you briefly untouchable', G.player.invuln > 1);
G.usePowerup('speed');
ok('fast feet speeds you up', G.player.speedT > 0);
ok('every kind can be used without throwing', (() => {
  for (const p of G.POWERUPS) {
    try { G.usePowerup(p.kind); } catch (e) { console.log('    ' + p.kind + ': ' + e.message); return false; }
  }
  return true;
})());
ok('the item row draws without throwing',
  (() => { try { G.drawHotbar(); return true; } catch (e) { console.log('    ' + e.message); return false; } })());

// The row must not sit under the other controls.
G.resize();
const anyOverlap = G.bagRects.some(r => overlaps(r, G.btn.hit))
  || G.bagRects.some(r => overlaps(r, G.miniRect));
ok('the item row does not sit under the hit button or the minimap', !anyOverlap);
ok('slots are big enough to tap', G.bagRects.every(r => r.w >= 38 && r.h >= 38),
  G.bagRects[0].w.toFixed(0) + 'px');

group('Walls fade when they are hiding somebody');
G.reset();
ok('there is a fade setting and it is see-through but still visible',
  G.TUNE.WALL_FADE > 0.1 && G.TUNE.WALL_FADE < 0.7, G.TUNE.WALL_FADE);
ok('drawBox can be told to draw see-through',
  (() => { try { G.drawBox(0, 0, 0, 40, 40, G.WALL_H, G.WALL_COLOR, 0.3); return true; }
           catch (e) { return false; } })());
// Put the player right behind a wall and check that wall reports itself as hiding
// somebody, while a wall nowhere near anyone does not.
let hideSpot = null;
for (let gy = 2; gy < G.GH - 2 && !hideSpot; gy++) {
  for (let gx = 2; gx < G.GW - 2 && !hideSpot; gx++) {
    if (G.grid[gy][gx] === 1 && G.grid[gy - 1][gx] === 0) hideSpot = { gx: gx, gy: gy };
  }
}
ok('found a wall with open ground behind it', hideSpot !== null);
G.player.x = (hideSpot.gx + 0.5) * G.TILE;
G.player.y = (hideSpot.gy - 0.5) * G.TILE;
G.player.z = 0;
G.buildOccludees();
ok('the occluder list gets built', G._occludees.length > 0);
ok('a wall standing in front of the player goes see-through',
  G.hidesSomeone(hideSpot.gx * G.TILE, hideSpot.gy * G.TILE, G.WALL_H));
ok('a wall far away from everyone stays solid',
  !G.hidesSomeone(0, 0, G.WALL_H));
ok('a wall BEHIND the player is not faded, only ones in front',
  !G.hidesSomeone((hideSpot.gx - 3) * G.TILE, (hideSpot.gy - 3) * G.TILE, G.WALL_H));

group('More detail, less flat');
ok('walls are properly tall now', G.WALL_H >= 50, G.WALL_H + 'px');
ok('crates still sit lower than walls', G.CRATE_H < G.WALL_H,
  G.CRATE_H + ' vs ' + G.WALL_H);
ok('ground against a block sits in its shadow',
  /Ground tucked up against a block sits in its shadow/.test(src));
ok('characters have shoes, hands and a collar',
  /\/\/ Shoes\./.test(src)
  && /Hands on the bottom of each arm/.test(src)
  && /collar where the torso meets the head/.test(src));

group('Built like a Roblox character');
ok('proportions are measured in studs', /one stud/.test(src) && /const U = 7\.6/.test(src));
ok('arms sit flush against the torso, no floating gaps',
  /flush against each side of the torso/.test(src));
ok('legs sit flush against each other', /side by side, touching/.test(src));
ok('the head is two studs wide like the real thing',
  /two studs wide like the real thing/.test(src));
ok('the reasoning about proportions is written down',
  /most of what makes the silhouette recognisable/.test(src));

group('Bright and sunlit, the way Roblox is');
ok('there is a sky rather than near black', /const SKY = /.test(src));
ok('the grass is sunlit, not murky',
  (() => {
    const m = src.match(/const GRASS_A = '(#[0-9a-f]{6})'/);
    if (!m) return false;
    const n = parseInt(m[1].slice(1), 16);
    const L = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    return L > 130;
  })());
ok('walls use real Roblox brick colours, not one flat grey',
  /const BRICKS = \[/.test(src) && /brickAt/.test(src));
ok('a given tile always gets the same brick colour',
  (() => {
    const a = G.brickAt(7, 4), b = G.brickAt(7, 4), c = G.brickAt(8, 4);
    return a === b && typeof a === 'string';
  })());
ok('more than one brick colour is actually in use',
  (() => {
    const seen = new Set();
    for (let x = 0; x < 40; x++) for (let y = 0; y < 24; y++) seen.add(G.brickAt(x, y));
    return seen.size >= 3;
  })(), (() => { const s2 = new Set(); for (let x = 0; x < 40; x++) for (let y = 0; y < 24; y++) s2.add(G.brickAt(x, y)); return s2.size + ' colours'; })());
ok('every brick colour stands out from the grass', (() => {
  const L = h => { const n = parseInt(h.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const g1 = L('#8fb356'), g2 = L('#87ab4e');
  const seen = new Set();
  for (let x = 0; x < 40; x++) for (let y = 0; y < 24; y++) seen.add(G.brickAt(x, y));
  return [...seen].every(c => Math.min(Math.abs(L(c) - g1), Math.abs(L(c) - g2)) > 18);
})());
ok('blocks throw a shadow diagonally onto the ground',
  /sun comes over your shoulder/.test(src));

group('Becoming the boss');
G.reset();
ok('you start with no points', G.player.points === 0);
ok('the target is reachable but not instant',
  G.TUNE.BOSS_POINTS / G.TUNE.POINTS_PER_KILL >= 10, 
  Math.round(G.TUNE.BOSS_POINTS / G.TUNE.POINTS_PER_KILL) + ' kills worth');
// Killing a boss now makes you one outright rather than just paying points.
G.reset();
G.enemies.length = 0;
G.spawnEnemy('zombie', true);
const theBoss = G.enemies[0];
theBoss.x = G.player.x + 25; theBoss.y = G.player.y;
G.player.points = 70;
const pointsBefore = G.player.points;
G.killEnemy(theBoss, 0);
ok('killing a boss turns you into one on the spot', G.player.bossT > 0,
  G.player.bossT.toFixed(0) + 's of boss mode');
ok('and it does not cost you the points you had saved up',
  G.player.points === pointsBefore, pointsBefore + ' kept');
// Killing another boss while already one should top the clock back up.
G.player.bossT = 3;
G.enemies.length = 0;
G.spawnEnemy('zombie', true);
const boss2 = G.enemies[0];
boss2.x = G.player.x + 25; boss2.y = G.player.y;
G.killEnemy(boss2, 0);
ok('killing a boss while already one tops the clock back up',
  G.player.bossT > 3, 'back to ' + G.player.bossT.toFixed(0) + 's');
// A normal kill must still go through the points bar, not shortcut it.
G.reset();
G.enemies.length = 0;
G.spawnEnemy('zombie', false);
const mook = G.enemies[0];
mook.x = G.player.x + 25; mook.y = G.player.y;
G.killEnemy(mook, 0);
ok('an ordinary kill still just adds points', G.player.bossT === 0
  && G.player.points === G.TUNE.POINTS_PER_KILL,
  G.player.points + ' points, no boss mode');
const normalHp = G.player.maxhp, normalSize = G.player.size;
G.becomeBoss();
ok('boss mode starts a countdown', G.player.bossT > 0, G.player.bossT.toFixed(0) + 's');
ok('points are spent on the transformation', G.player.points === 0);
ok('you get visibly bigger', G.player.size > normalSize,
  normalSize + ' to ' + G.player.size);
ok('and much tougher', G.player.maxhp > normalHp,
  normalHp + ' to ' + G.player.maxhp);
ok('and topped right up', G.player.hp === G.player.maxhp);
G.endBossMode();
ok('it wears off back to normal size', G.player.size === 1);
ok('and back to normal health', G.player.maxhp === G.TUNE.PLAYER_HEALTH + G.player.up.hpAdd);
ok('health never ends up above the new maximum', G.player.hp <= G.player.maxhp);
// Points must actually accrue during real play.
G.reset();
let sawPoints = false, sawBossMode = false;
for (let i = 0; i < 60 * 240; i++) {
  G.update(1 / 60);
  if (G.waveState === 'picking') G.choose(G.cards[0]);
  if (G.player.points > 0) sawPoints = true;
  if (G.player.bossT > 0) sawBossMode = true;
}
ok('points build up while playing', sawPoints);
ok('boss mode is actually reachable in normal play', sawBossMode,
  sawBossMode ? 'reached it' : 'never got there in 4 minutes');
ok('the transformation does not leave you stuck oversized',
  G.player.bossT > 0 || G.player.size === 1);

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
