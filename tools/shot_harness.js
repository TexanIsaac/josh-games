// Screenshot harness. Injected at the end of the game script by tools/shot.py so it
// shares the game's scope and can reach player, enemies, grid, cam and the rest.
//
// This exists because the tests cannot see. They count canvas operations and assert on
// numbers, and twice now a bug has been invisible to every one of them and obvious in a
// picture: the blocky rig never reaching the screen at all (July), and every character
// having a black arm and a black leg (2 August). If something is described as looking
// wrong, take a picture before touching the code.
//
// Modes:
//   closeup   one player and one zombie on open grass, camera in tight. The one to use
//             for judging proportions and colours. It is also the most reliable frame,
//             because it does not depend on where the random map put anything.
//   faces     a small crowd at conversational distance
//   trench    stood at the lip of the longest trench on the map
//   inside    stood in the bottom of that trench, with company
(function () {
  const MODE = (location.search.match(/mode=(\w+)/) || [])[1] || 'closeup';
  const ZOOM = { closeup: 0.16, faces: 0.34, inside: 0.42, trench: 0.62 };
  let note = '';

  function findTrench() {
    let best = null;
    for (let gy = 3; gy < GH - 3; gy++) {
      for (let gx = 3; gx < GW - 3; gx++) {
        if (grid[gy][gx] !== TRENCH) continue;
        let run = 0;
        while (gx + run < GW - 3 && grid[gy][gx + run] === TRENCH) run++;
        if (!best || run > best.run) best = { gx: gx, gy: gy, run: run };
      }
    }
    return best;
  }

  const t = findTrench();

  function pose() {
    // Zoom is recomputed from camZoom every frame, so it has to be set every frame.
    camZoom = ZOOM[MODE] || 0.6;
    // Nothing may die, or the wave clears and the card screen covers the view.
    player.hp = player.maxhp;
    player.invuln = 999;
    player.bite = 0;
    player.cool = 99;

    if (MODE === 'closeup') {
      player.x = 36 * TILE + 20; player.y = 22 * TILE + 20; player.z = 0;
      player.moving = false; player.faceAng = Math.PI / 2; player.walk = 0;
      if (enemies.length !== 1) { enemies.length = 0; spawnEnemy('zombie', false); }
      const z = enemies[0];
      z.x = player.x + 40; z.y = player.y; z.z = 0;
      z.rank = 0; z.hp = 99999; z.maxhp = 99999;
      z.moving = false; z.walk = 0; z.faceAng = Math.PI / 2; z.cool = 99;
      note = 'player left, zombie right   BODY_TOP ' + BODY_TOP
           + '   TRENCH_D ' + TRENCH_D;
      return;
    }

    if (t) {
      if (MODE === 'inside') {
        player.x = (t.gx + t.run * 0.5) * TILE + TILE / 2;
        player.y = (t.gy + 0.5) * TILE;
      } else {
        player.x = (t.gx + t.run * 0.5) * TILE;
        player.y = (t.gy + 2.4) * TILE;
        player.z = 0;
      }
      note = 'trench at ' + t.gx + ',' + t.gy + '  run ' + t.run
           + ' tiles   TRENCH_D ' + TRENCH_D + '   BODY_TOP ' + BODY_TOP;
    } else {
      note = 'NO TRENCH ON THIS MAP, reroll';
    }

    const ring = 86, many = 6;
    if (enemies.length !== many) {
      enemies.length = 0;
      for (let i = 0; i < many; i++) spawnEnemy('zombie', false);
    }
    for (let i = 0; i < enemies.length; i++) {
      const a = (i / many) * Math.PI * 2 - Math.PI / 2;
      const e = enemies[i];
      e.x = player.x + Math.cos(a) * ring;
      e.y = player.y + Math.sin(a) * ring;
      e.z = 0;
      e.rank = i % ZOMBIE_RANKS.length;
      e.hp = 99999; e.maxhp = 99999; e.cool = 99;
      e.moving = true;
      e.faceAng = a + Math.PI;
      if (MODE === 'inside' && t && i < 3) {
        e.x = (t.gx + i + 0.5) * TILE;
        e.y = (t.gy + 0.5) * TILE;
      }
    }
  }

  // The numbers go straight onto the canvas, because a PNG is all that comes back out
  // of a headless run and a console line would be lost.
  function stamp() {
    const c = document.querySelector('canvas');
    if (!c) return;
    const g = c.getContext('2d');
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillRect(0, c.height - 32, c.width, 32);
    g.fillStyle = '#7ad7ff';
    g.font = '15px monospace';
    g.fillText(MODE + '   ' + note, 12, c.height - 11);
    g.restore();
  }

  window.addEventListener('load', function () {
    try {
      startGame();
    } catch (err) {
      document.title = 'START FAILED: ' + err.message;
      return;
    }
    if (MODE === 'closeup') cam.pitch *= 0.40;
    else if (MODE === 'faces') cam.pitch *= 0.60;
    const iv = setInterval(pose, 16);
    setTimeout(function () { clearInterval(iv); stamp(); }, 4200);
    setTimeout(stamp, 4600);
  });
})();
