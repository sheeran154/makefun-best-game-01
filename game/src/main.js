// VOIDSTRIKE v2 — entry point: the frame loop, the screens, and the wiring between
// input, world, sound and render. In normal play it runs the loop; with
// ?shot=name&seed=N it stages one deterministic screenshot scene instead.
import { VIEW, STEP } from './config.js';
import { createWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_VICTORY, SCREEN_UPGRADE, EVENT_WAVE_CLEAR, EVENT_GAME_OVER, EVENT_VICTORY, EVENT_BOSS } from './world.js';
import { render, draftCardRects } from './render.js';
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
    else if (event === 'boss-phase2') sfx.phase2();
    else if (event === 'kill') sfx.explosion(false);
    else if (event === 'boss-kill') sfx.explosion(true);
    else if (event === 'dash') sfx.dash();
    else if (event === 'bomb') sfx.bomb();
    else if (event === 'upgrade') sfx.upgrade();
  }
}

// Pick an upgrade card by its index (0-2); returns true when a pick landed.
function pickUpgrade(index) {
  if (world.applyUpgrade(index)) {
    sfx.upgrade();
    setStatus('Upgrade acquired. Next wave incoming.');
    return true;
  }
  return false;
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
  const kinds = {};
  let elites = 0;
  for (const e of world.state.enemies) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    if (e.elite) elites += 1;
  }
  window.__voidstrike = {
    shot: shotName,
    screen: world.state.screen,
    score: world.state.score,
    wave: world.state.wave,
    kills: world.state.kills,
    enemies: world.state.enemies.length,
    bullets: world.state.bullets.length,
    kinds,
    elites,
    bossPhase: world.state.boss ? world.state.boss.phase : -1,
    upgrades: [...world.state.upgradesPicked],
    dashes: world.state.dashes,
    bombsUsed: world.state.bombsUsed,
    lives: world.state.lives,
  };
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

    // Snapshot every edge press once, at the top of the frame, then clear the
    // queue right away: a press that lands later in this frame survives to the
    // next frame's snapshot instead of being dropped by an end-of-frame clear.
    const edge = {
      enter: input.wasPressed('Enter') || input.wasPressed('NumpadEnter'),
      click: input.wasPressed('MouseClick'),
      r: input.wasPressed('KeyR'),
      p: input.wasPressed('KeyP'),
      m: input.wasPressed('KeyM'),
      d1: input.wasPressed('Digit1') || input.wasPressed('Numpad1'),
      d2: input.wasPressed('Digit2') || input.wasPressed('Numpad2'),
      d3: input.wasPressed('Digit3') || input.wasPressed('Numpad3'),
      dash: input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight') || input.wasPressed('MouseRight'),
      bomb: input.wasPressed('KeyB') || input.wasPressed('KeyQ'),
    };
    input.endFrame();

    // The upgrade draft owns its own keys and clicks.
    if (screen === SCREEN_UPGRADE) {
      if (edge.d1) pickUpgrade(0);
      else if (edge.d2) pickUpgrade(1);
      else if (edge.d3) pickUpgrade(2);
      else if (edge.click) {
        const rects = draftCardRects();
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
            pickUpgrade(i);
            break;
          }
        }
      }
    }

    // Menu keys, checked once per frame.
    if (edge.enter || (screen !== SCREEN_UPGRADE && edge.click)) {
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
    if (edge.r) {
      unlockAudio();
      if (screen !== SCREEN_TITLE) {
        sfx.click();
        world.startGame();
        setStatus('Playing. WASD to fly, mouse to aim, click or Space to fire.');
      }
    }
    if (edge.p) {
      if (screen === SCREEN_PLAY) {
        state.screen = SCREEN_PAUSE;
        setStatus('Paused. Press P to resume.');
      } else if (screen === SCREEN_PAUSE) {
        state.screen = SCREEN_PLAY;
        setStatus('Playing.');
      }
    }
    if (edge.m) {
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
        dash: edge.dash,
        bomb: edge.bomb,
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
      // Menus, the draft and end screens still animate the starfield.
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 100, fire: false, dash: false, bomb: false });
      accumulator = 0;
    }

    if (world.state.score > best) {
      best = world.state.score;
      world.best = best;
      saveBest(best);
    }

    render(ctx, world, best);
  }

  // Test hook: Playwright drives the real game through this and reads state.
  window.VOIDSTRIKE = {
    world,
    input,
    state() {
      const s = world.state;
      const kinds = {};
      let elites = 0;
      for (const e of s.enemies) {
        kinds[e.kind] = (kinds[e.kind] || 0) + 1;
        if (e.elite) elites += 1;
      }
      return {
        screen: s.screen,
        score: s.score,
        wave: s.wave,
        lives: s.lives,
        enemies: s.enemies.length,
        shots: s.shots.length,
        bullets: s.bullets.length,
        kills: s.kills,
        kinds,
        elites,
        bombs: s.bombs,
        bombsMax: s.bombsMax,
        dashes: s.dashes,
        bombsUsed: s.bombsUsed,
        dashCooldown: Math.round(s.player.dashCooldown * 100) / 100,
        upgrades: [...s.upgradesPicked],
        draft: s.upgradeDraft ? s.upgradeDraft.options.map((o) => o.id) : null,
        bossPhase: s.boss ? s.boss.phase : -1,
        best,
      };
    },
    start() {
      world.startGame();
    },
  };

  requestAnimationFrame(frame);
}
