// VOIDSTRIKE — the screenshot scenes behind ?shot=start|play|boss|end. Each one
// plays the real rules forward from a fresh world for a fixed stretch, steered by
// an autopilot that dodges bullets and shoots the nearest hostile, so every frame
// is what a real game looks like and the same seed always gives the same frame.
import { VIEW, STEP, PLAYER } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_VICTORY } from './world.js';

const IDLE = { mx: 0, my: 0, aimX: VIEW.width / 2, aimY: 100, fire: false };

/**
 * Steer the ship: dodge the nearest threatening bullet, keep clear of rammers,
 * otherwise line up under the nearest hostile and hold fire on it. `dodge`
 * false makes a careless pilot that walks into fire (for the game-over scene).
 */
export function autopilotInput(world, dodge = true) {
  const state = world.state;
  const p = state.player;
  if (!p.alive) return IDLE;
  let mx = 0;
  let my = 0;

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
      }
    }
    for (const e of state.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < e.radius + 46 && d > 0.01) {
        mx += (dx / d) * 1.2;
        my += (dy / d) * 1.2;
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
  return { mx, my, aimX, aimY, fire: true };
}

// Step the world until `done(state)` is true, the screen leaves play, or the
// step budget runs out. Returns true when `done` was reached.
function runUntil(world, done, maxSeconds, dodge = true) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    world.step(STEP, autopilotInput(world, dodge));
    if (world.state.screen !== SCREEN_PLAY) return done(world.state);
    if (done(world.state)) return true;
  }
  return done(world.state);
}

function playFor(world, seconds, dodge = true) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, autopilotInput(world, dodge));
    if (world.state.screen !== SCREEN_PLAY) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw. The world must
 * already be fresh (created with the scene's seed). The end scene tries for a
 * real victory first and falls back to a real game over.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // Stop the moment the frame is busy: hostiles on screen and fire in the
    // air, so the shot shows the fight, not an empty sky between waves.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startGame();
      const steps = Math.floor(40 / STEP);
      for (let i = 0; i < steps; i += 1) {
        world.step(STEP, autopilotInput(world));
        const s = world.state;
        if (s.screen !== SCREEN_PLAY) break;
        if (world.time > 8 && s.enemies.length >= 5 && (s.bullets.length >= 3 || s.shots.length >= 4) && s.score > 0) {
          return { screen: SCREEN_PLAY };
        }
      }
    }
    world.reset();
    world.startGame();
    playFor(world, 24);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'boss') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startGame();
      const reached = runUntil(world, (s) => s.wave >= 5 && s.boss !== null, 420);
      if (reached && world.state.screen === SCREEN_PLAY) {
        playFor(world, 14);
        if (world.state.screen === SCREEN_PLAY && world.state.boss) return { screen: SCREEN_PLAY };
      }
    }
    world.reset();
    world.startGame();
    runUntil(world, (s) => s.wave >= 5 && s.boss !== null, 420);
    playFor(world, 14);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'end') {
    // Try to win the sector outright.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startGame();
      runUntil(world, () => false, 900);
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
