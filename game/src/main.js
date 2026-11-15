// VOIDSTRIKE — entry point: the frame loop, the screens, and the wiring between
// input, world, sound and render. In normal play it runs the loop; with
// ?shot=name&seed=N it stages one deterministic screenshot scene instead.
import { VIEW, STEP } from './config.js';
import { createWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_VICTORY, EVENT_WAVE_CLEAR, EVENT_GAME_OVER, EVENT_VICTORY, EVENT_BOSS } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { sfx, unlockAudio, toggleMute } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const BEST_KEY = 'voidstrike-best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage may be unavailable; the score still shows in this session.
  }
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}

const input = createInput(canvas);
const seed = Number(params.get('seed') || '20261116');
const world = createWorld(seed);
world.best = loadBest();
let best = world.best;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function handleEvents(events) {
  for (const event of events) {
    if (event === 'shoot') sfx.shoot();
    else if (event === 'enemy-shoot') sfx.enemyShoot();
    else if (event === 'player-hit') sfx.hit();
    else if (event === 'shield-hit') sfx.shieldUp();
    else if (event === 'shield-up') sfx.shieldUp();
    else if (event === 'powerup') sfx.powerup();
    else if (event === EVENT_WAVE_CLEAR) sfx.waveClear();
    else if (event === EVENT_BOSS) sfx.bossAlarm();
    else if (event === EVENT_VICTORY) sfx.victory();
    else if (event === EVENT_GAME_OVER) { sfx.explosion(true); sfx.gameOver(); }
    else if (event === 'boss-attack') sfx.enemyShoot();
    else if (event === 'kill') sfx.explosion(false);
    else if (event === 'boss-kill') sfx.explosion(true);
  }
}

// ---- Screenshot mode: stage one scene, draw it once, and stop. ----
const shotName = params.get('shot');
if (shotName) {
  const staged = stageShot(shotName, world);
  if (world.state.screen !== staged.screen) {
    // stageShot returns the screen the frame should show; the world already
    // holds it except for the title scene, which is the world's reset state.
    world.state.screen = staged.screen;
  }
  best = Math.max(best, world.state.score);
  render(ctx, world, best);
  window.__shotReady = true;
  window.__voidstrike = { shot: shotName, screen: world.state.screen, score: world.state.score, wave: world.state.wave };
} else {
  // ---- Normal play. ----
  window.addEventListener('resize', fitCanvas);
  fitCanvas();
  setStatus('VOIDSTRIKE. Press Enter or click to launch.');

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    accumulator += dt;

    const state = world.state;
    const screen = state.screen;

    // Menu keys, checked once per frame.
    if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter') || input.wasPressed('MouseClick')) {
      unlockAudio();
      if (screen === SCREEN_TITLE) {
        sfx.click();
        world.startGame();
        setStatus('Playing. WASD to fly, mouse to aim, click or Space to fire.');
      } else if (screen === SCREEN_PAUSE) {
        state.screen = SCREEN_PLAY;
        sfx.click();
      } else if (screen === SCREEN_OVER) {
        world.reset();
        setStatus('VOIDSTRIKE. Press Enter or click to launch.');
      } else if (screen === SCREEN_VICTORY) {
        world.continueEndless();
        setStatus('Endless mode. The void keeps coming.');
      }
    }
    if (input.wasPressed('KeyR')) {
      unlockAudio();
      if (screen !== SCREEN_TITLE) {
        sfx.click();
        world.startGame();
        setStatus('Playing. WASD to fly, mouse to aim, click or Space to fire.');
      }
    }
    if (input.wasPressed('KeyP')) {
      if (screen === SCREEN_PLAY) {
        state.screen = SCREEN_PAUSE;
        setStatus('Paused. Press P to resume.');
      } else if (screen === SCREEN_PAUSE) {
        state.screen = SCREEN_PLAY;
        setStatus('Playing.');
      }
    }
    if (input.wasPressed('KeyM')) {
      const muted = toggleMute();
      setStatus(muted ? 'Sound muted.' : 'Sound on.');
    }

    // Fixed-step simulation while playing.
    if (state.screen === SCREEN_PLAY) {
      const mv = input.moveVector();
      const gameInput = {
        mx: mv.x,
        my: mv.y,
        aimX: input.mouse.x,
        aimY: input.mouse.y,
        fire: input.firing(),
      };
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        const events = world.step(STEP, gameInput);
        handleEvents(events);
        accumulator -= STEP;
        steps += 1;
        if (world.state.screen !== SCREEN_PLAY) break;
      }
      if (steps === 5) accumulator = 0;
    } else {
      // Menus and end screens still animate the starfield.
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 100, fire: false });
      accumulator = 0;
    }

    if (world.state.score > best) {
      best = world.state.score;
      world.best = best;
      saveBest(best);
    }

    render(ctx, world, best);
    input.endFrame();
  }

  // Test hook: Playwright drives the real game through this and reads state.
  window.VOIDSTRIKE = {
    world,
    input,
    state() {
      const s = world.state;
      return {
        screen: s.screen,
        score: s.score,
        wave: s.wave,
        lives: s.lives,
        enemies: s.enemies.length,
        shots: s.shots.length,
        bullets: s.bullets.length,
        kills: s.kills,
        best,
      };
    },
    start() {
      world.startGame();
    },
  };

  requestAnimationFrame(frame);
}
