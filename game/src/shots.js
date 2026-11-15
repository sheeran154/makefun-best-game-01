// VOIDSTRIKE v2 — the screenshot scenes behind ?shot=start|play|boss|end. Each one
// plays the real rules forward from a fresh world for a fixed stretch, steered by
// an autopilot that dodges bullets, dashes out of danger, bombs when swamped
// and shoots the nearest hostile, so every frame is what a real game looks like
// and the same seed always gives the same frame. The autopilot also picks the
// first upgrade card at every draft, so a staged run plays the v2 systems too.
import { VIEW, STEP, PLAYER } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_VICTORY, SCREEN_UPGRADE } from './world.js';

const IDLE = { mx: 0, my: 0, aimX: VIEW.width / 2, aimY: 100, fire: false, dash: false, bomb: false };

/**
 * Steer the ship: dodge the nearest threatening bullet, keep clear of rammers,
 * dash when something is about to hit, bomb when the sky is full of bullets,
 * otherwise line up under the nearest hostile and hold fire on it. `dodge`
 * false makes a careless pilot that walks into fire (for the game-over scene).
 */
export function autopilotInput(world, dodge = true) {
  const state = world.state;
  const p = state.player;
  if (!p.alive) return IDLE;
  let mx = 0;
  let my = 0;
  let dash = false;

  if (dodge) {
    for (const b of state.bullets) {
      const rx = p.x - b.x;
      const ry = p.y - b.y;
      const rvx = -b.vx;
      const rvy = -b.vy;
      const speed2 = rvx * rvx + rvy * rvy || 1;
      let t = (rx * rvx + ry * rvy) / speed2;
      t = Math.max(0, Math.min(0.7, t));
      const cx = b.x + b.vx * t;
      const cy = b.y + b.vy * t;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < 70 && d > 0.01) {
        mx += (dx / d) * 1.6;
        my += (dy / d) * 1.6;
        if (d < 55 && p.dashCooldown <= 0) dash = true;
      }
    }
    for (const e of state.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < e.radius + 46 && d > 0.01) {
        mx += (dx / d) * 1.2;
        my += (dy / d) * 1.2;
        if (d < e.radius + 30 && p.dashCooldown <= 0) dash = true;
      }
    }
  }

  // Nearest hostile (the boss first, always).
  let target = state.boss;
  if (!target) {
    let best = Infinity;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        target = e;
      }
    }
  }
  let aimX = p.x;
  let aimY = p.y - 200;
  if (target) {
    aimX = target.x;
    aimY = target.y;
    if (mx === 0 && my === 0) {
      const wantX = target.x;
      const wantY = Math.min(target.y + 280, VIEW.height - 80);
      const dx = wantX - p.x;
      const dy = wantY - p.y;
      if (Math.abs(dx) > 14) mx += Math.sign(dx) * 0.9;
      if (Math.abs(dy) > 14) my += Math.sign(dy) * 0.9;
    }
  } else {
    const dx = VIEW.width / 2 - p.x;
    const dy = 600 - p.y;
    if (Math.abs(dx) > 14) mx += Math.sign(dx) * 0.8;
    if (Math.abs(dy) > 14) my += Math.sign(dy) * 0.8;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  // Bomb only when the sky is genuinely full — it is a scarce resource.
  const bomb = dodge && state.bullets.length >= 18 && state.bombs > 0;
  return { mx, my, aimX, aimY, fire: true, dash, bomb };
}

// Step the world once, auto-picking the first upgrade card whenever a draft
// opens. Returns the screen after the step.
function stepAuto(world, dodge = true) {
  world.step(STEP, autopilotInput(world, dodge));
  if (world.state.screen === SCREEN_UPGRADE) world.applyUpgrade(0);
  return world.state.screen;
}

// Step the world until `done(state)` is true, the screen leaves play, or the
// step budget runs out. Returns true when `done` was reached.
function runUntil(world, done, maxSeconds, dodge = true) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    const screen = stepAuto(world, dodge);
    if (screen !== SCREEN_PLAY) return done(world.state);
    if (done(world.state)) return true;
  }
  return done(world.state);
}

function playFor(world, seconds, dodge = true) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (stepAuto(world, dodge) !== SCREEN_PLAY) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw. The world must
 * already be fresh (created with the scene's seed). The end scene tries for a
 * real victory first and falls back to a real game over.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // A high wave, a busy frame: hostiles on screen, bullets in the air, a
    // real score — and one dash right before the capture so the afterimages
    // are in the frame.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startGame();
      const reached = runUntil(
        world,
        (s) => s.wave >= 5 && s.enemies.length >= 6 && s.bullets.length >= 5 && s.score > 5000
          && s.enemies.some((e) => e.kind === 'slicer'),
        420,
      );
      if (reached && world.state.screen === SCREEN_PLAY) {
        const inp = autopilotInput(world);
        world.step(STEP, { ...inp, dash: true });
        if (world.state.screen === SCREEN_UPGRADE) world.applyUpgrade(0);
        playFor(world, 0.1);
        if (world.state.screen === SCREEN_PLAY) return { screen: SCREEN_PLAY };
      }
    }
    world.reset();
    world.startGame();
    runUntil(world, (s) => s.wave >= 5, 420);
    playFor(world, 24);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'boss') {
    // The wave-10 Void Maw in its second phase, spiral barrage in the air.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startGame();
      const reached = runUntil(world, (s) => s.wave >= 10 && s.boss !== null && s.boss.phase === 1, 1500);
      if (reached && world.state.screen === SCREEN_PLAY) {
        playFor(world, 5);
        // Let the spiral fill the frame before capturing.
        let extra = 0;
        while (world.state.screen === SCREEN_PLAY && world.state.boss && world.state.bullets.length < 8 && extra < 12) {
          playFor(world, 1);
          extra += 1;
        }
        if (world.state.screen === SCREEN_PLAY && world.state.boss) return { screen: SCREEN_PLAY };
      }
    }
    world.reset();
    world.startGame();
    runUntil(world, (s) => s.wave >= 10 && s.boss !== null, 1500);
    playFor(world, 10);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'end') {
    // Try to win the sector outright.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startGame();
      runUntil(world, () => false, 1200);
      if (world.state.screen === SCREEN_VICTORY) return { screen: SCREEN_VICTORY };
    }
    // Otherwise a hurried pilot goes down in flames: a real game over.
    world.reset();
    world.startGame();
    runUntil(world, () => false, 600, false);
    if (world.state.screen !== SCREEN_OVER) {
      // The careless pilot survived too long; stop shooting and drift into fire.
      const steps = Math.floor(120 / STEP);
      for (let i = 0; i < steps; i += 1) {
        world.step(STEP, IDLE);
        if (world.state.screen === SCREEN_OVER) break;
      }
    }
    return { screen: world.state.screen === SCREEN_OVER ? SCREEN_OVER : SCREEN_PLAY };
  }

  // Default: the title screen over a living starfield.
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, IDLE);
  return { screen: 'title' };
}
