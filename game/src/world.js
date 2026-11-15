// VOIDSTRIKE — the world: one object holding every moving thing, the wave
// director, collisions and scoring. It knows nothing about the canvas or the DOM;
// render.js draws whatever state it holds. All randomness flows through the
// seeded RNG, so a seed replays the same game exactly.
import { VIEW, STEP, PLAYER, POWERUP, ENEMY, BOSS_WAVE_EVERY, VICTORY_WAVE, COMBO_WINDOW, COMBO_MAX, wavePlan } from './config.js';
import { mulberry32, range, pick, shuffle } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export const EVENT_WAVE_CLEAR = 'wave-clear';
export const EVENT_GAME_OVER = 'game-over';
export const EVENT_VICTORY = 'victory';
export const EVENT_BOSS = 'boss';

const TAU = Math.PI * 2;

function makeStars(rng) {
  const stars = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const count = [70, 45, 25][layer];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng() * VIEW.width,
        y: rng() * VIEW.height,
        layer,
        size: 0.6 + layer * 0.7 + rng() * 0.8,
        speed: 12 + layer * 22,
        phase: rng() * TAU,
      });
    }
  }
  return stars;
}

function makeNebulae(rng) {
  const hues = ['#3b0f6e', '#0f3a6e', '#6e0f3a', '#0f6e5a'];
  const blobs = [];
  for (let i = 0; i < 5; i += 1) {
    blobs.push({
      x: rng() * VIEW.width,
      y: rng() * VIEW.height,
      r: 180 + rng() * 220,
      color: hues[i % hues.length],
    });
  }
  return blobs;
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const world = {
    rng,
    screen: SCREEN_TITLE,
    time: 0,
    state: null,
    events: [],
    stars: makeStars(rng),
    nebulae: makeNebulae(rng),
  };

  world.reset = function reset() {
    world.time = 0;
    world.events = [];
    world.state = {
      screen: SCREEN_TITLE,
      score: 0,
      best: 0,
      wave: 0,
      lives: PLAYER.maxLives,
      combo: 0,
      comboTimer: 0,
      kills: 0,
      shotsFired: 0,
      hits: 0,
      endless: false,
      waveActive: false,
      spawnQueue: [],
      spawnTimer: 0,
      breather: 0,
      boss: null,
      banner: null,
      shake: 0,
      flash: 0,
      player: {
        x: VIEW.width / 2,
        y: PLAYER.respawnY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        fireCooldown: 0,
        invulnerable: 0,
        shield: 0,
        spreadTimer: 0,
        rapidTimer: 0,
        alive: true,
        deathTimer: 0,
      },
      enemies: [],
      bullets: [],
      shots: [],
      particles: [],
      powerups: [],
      floaters: [],
    };
  };

  world.reset();

  function addFloater(state, x, y, text, color, size = 16) {
    state.floaters.push({ x, y, text, color, size, life: 1.1, maxLife: 1.1 });
  }

  function burst(state, x, y, color, count, speed, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const a = rng() * TAU;
      const v = speed * (0.3 + rng() * 0.7);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.5 + rng() * 0.5,
        maxLife: 1,
        size: size * (0.6 + rng() * 0.8),
        color,
        drag: 0.92,
      });
    }
  }

  function startWave(state, wave) {
    state.wave = wave;
    state.waveActive = true;
    state.spawnQueue = shuffle(rng, wavePlan(wave));
    if (wave % BOSS_WAVE_EVERY === 0) state.spawnQueue.push('boss');
    state.spawnTimer = 0.4;
    if (wave % BOSS_WAVE_EVERY === 0) {
      state.banner = { text: '⚠ WARNING ⚠', sub: 'VOID MAW APPROACHES', t: 2.6, color: '#ff2e63' };
      world.events.push(EVENT_BOSS);
    } else {
      state.banner = { text: `WAVE ${wave}`, sub: wave === 1 ? 'HOSTILES INBOUND' : `${state.spawnQueue.length} HOSTILES`, t: 2.0, color: '#e8f6ff' };
    }
  }

  function spawnEnemy(state, kind) {
    const def = ENEMY[kind];
    const x = kind === 'boss' ? VIEW.width / 2 : range(rng, 50, VIEW.width - 50);
    const enemy = {
      kind,
      x,
      y: kind === 'boss' ? -80 : -40,
      vx: 0,
      vy: 0,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      score: def.score,
      color: def.color,
      t: rng() * TAU,
      fireTimer: range(rng, 1.2, 2.4),
      burstLeft: 0,
      burstTimer: 0,
      attack: 0,
      attackTimer: 2.5,
      phase: 0,
      alive: true,
    };
    if (kind === 'boss') {
      enemy.hp = def.hp + (state.wave - BOSS_WAVE_EVERY) * 40;
      enemy.maxHp = enemy.hp;
      state.boss = enemy;
    }
    state.enemies.push(enemy);
  }

  function dropPowerup(state, x, y) {
    if (rng() >= POWERUP.dropChance) return;
    const roll = rng();
    let kind = 'shield';
    if (roll < 0.3) kind = 'shield';
    else if (roll < 0.6) kind = 'spread';
    else if (roll < 0.85) kind = 'rapid';
    else kind = state.lives < PLAYER.maxLives ? 'life' : 'spread';
    state.powerups.push({ x, y, kind, vy: POWERUP.fallSpeed, t: 0 });
  }

  function killEnemy(state, enemy, awardScore = true) {
    enemy.alive = false;
    burst(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 90 : 22, enemy.kind === 'boss' ? 420 : 260, enemy.kind === 'boss' ? 5 : 3);
    burst(state, enemy.x, enemy.y, '#ffffff', 8, 180, 2);
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.shake = Math.max(state.shake, 18);
      state.flash = 0.5;
    } else {
      state.shake = Math.max(state.shake, 4);
    }
    if (awardScore) {
      state.combo += 1;
      state.comboTimer = COMBO_WINDOW;
      const mult = Math.min(state.combo, COMBO_MAX);
      const gained = enemy.score * mult;
      state.score += gained;
      state.kills += 1;
      addFloater(state, enemy.x, enemy.y, `+${gained}`, mult > 1 ? '#ffd75e' : '#e8f6ff', mult > 1 ? 19 : 15);
      if (mult >= 4) addFloater(state, enemy.x, enemy.y - 22, `COMBO x${mult}`, '#ffd75e', 15);
      dropPowerup(state, enemy.x, enemy.y);
      world.events.push(enemy.kind === 'boss' ? 'boss-kill' : 'kill');
    }
  }

  function damagePlayer(state) {
    const p = state.player;
    if (p.invulnerable > 0 || !p.alive) return;
    if (p.shield > 0) {
      p.shield -= 1;
      p.invulnerable = 1.0;
      state.shake = Math.max(state.shake, 8);
      burst(state, p.x, p.y, '#4dd7ff', 18, 240, 3);
      addFloater(state, p.x, p.y - 26, 'SHIELD DOWN', '#4dd7ff', 16);
      world.events.push('shield-hit');
      return;
    }
    p.invulnerable = PLAYER.invulnerableSeconds;
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 14);
    state.flash = 0.4;
    burst(state, p.x, p.y, '#3dffc8', 40, 320, 4);
    burst(state, p.x, p.y, '#ff5d73', 20, 220, 3);
    world.events.push('player-hit');
    if (state.lives <= 0) {
      p.alive = false;
      p.deathTimer = 1.4;
      world.events.push(EVENT_GAME_OVER);
    } else {
      p.invulnerable = PLAYER.invulnerableSeconds;
      p.x = VIEW.width / 2;
      p.y = PLAYER.respawnY;
      p.spreadTimer = 0;
      p.rapidTimer = 0;
    }
  }

  function firePlayer(state) {
    const p = state.player;
    const interval = p.rapidTimer > 0 ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
    if (p.fireCooldown > 0) return;
    p.fireCooldown = interval;
    const spread = p.spreadTimer > 0;
    const angles = spread ? [-0.16, 0, 0.16] : [0];
    const base = p.angle;
    for (const off of angles) {
      const a = base + off;
      state.shots.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * PLAYER.bulletSpeed,
        vy: Math.sin(a) * PLAYER.bulletSpeed,
        damage: PLAYER.bulletDamage,
        radius: 4,
      });
    }
    state.shotsFired += 1;
    world.events.push('shoot');
  }

  function enemyShoot(state, enemy, angle, speed = 230) {
    state.bullets.push({
      x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
      y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 5,
    });
    world.events.push('enemy-shoot');
  }

  function updateEnemy(state, enemy, dt) {
    const p = state.player;
    enemy.t += dt;
    enemy.fireTimer -= dt;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aim = Math.atan2(dy, dx);

    if (enemy.kind === 'drifter') {
      enemy.y += ENEMY.drifter.speed * dt;
      enemy.x += Math.sin(enemy.t * 2.2) * 55 * dt;
    } else if (enemy.kind === 'stinger') {
      enemy.y += ENEMY.stinger.speed * dt;
      enemy.x += (dx / dist) * 90 * dt;
      if (enemy.fireTimer <= 0 && enemy.y > 0 && enemy.y < VIEW.height * 0.75) {
        enemy.fireTimer = 2.3;
        enemyShoot(state, enemy, aim + range(rng, -0.08, 0.08));
      }
    } else if (enemy.kind === 'weaver') {
      enemy.y += ENEMY.weaver.speed * dt;
      enemy.x += Math.sin(enemy.t * 3.1) * 190 * dt;
      if (enemy.fireTimer <= 0 && enemy.y > 0 && enemy.y < VIEW.height * 0.7) {
        enemy.fireTimer = 2.8;
        for (const off of [-0.28, 0, 0.28]) enemyShoot(state, enemy, aim + off, 210);
      }
    } else if (enemy.kind === 'bulwark') {
      if (enemy.y < 130) {
        enemy.y += ENEMY.bulwark.speed * dt;
      } else {
        enemy.x += Math.sin(enemy.t * 0.9) * 60 * dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = 3.1;
          enemy.burstLeft = 3;
          enemy.burstTimer = 0;
        }
        if (enemy.burstLeft > 0) {
          enemy.burstTimer -= dt;
          if (enemy.burstTimer <= 0) {
            enemy.burstTimer = 0.16;
            enemy.burstLeft -= 1;
            enemyShoot(state, enemy, aim + range(rng, -0.06, 0.06), 250);
          }
        }
      }
    } else if (enemy.kind === 'boss') {
      if (enemy.y < 120) {
        enemy.y += 60 * dt;
      } else {
        enemy.x += Math.sin(enemy.t * 0.7) * 110 * dt;
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attack = (enemy.attack + 1) % 3;
          enemy.attackTimer = enemy.attack === 2 ? 4.5 : 3.4;
          if (enemy.attack === 0) {
            // Radial burst.
            for (let i = 0; i < 16; i += 1) enemyShoot(state, enemy, (i / 16) * TAU, 190);
            world.events.push('boss-attack');
          } else if (enemy.attack === 1) {
            enemy.burstLeft = 5;
            enemy.burstTimer = 0;
          } else {
            // Summon minions.
            for (let i = 0; i < 3; i += 1) {
              const m = {
                kind: 'drifter', x: enemy.x + (i - 1) * 90, y: enemy.y + 50,
                vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 16, score: 100,
                color: ENEMY.drifter.color, t: rng() * TAU, fireTimer: 2,
                burstLeft: 0, burstTimer: 0, attack: 0, attackTimer: 0, phase: 0, alive: true,
              };
              state.enemies.push(m);
            }
            world.events.push('boss-attack');
          }
        }
        if (enemy.attack === 1 && enemy.burstLeft > 0) {
          enemy.burstTimer -= dt;
          if (enemy.burstTimer <= 0) {
            enemy.burstTimer = 0.14;
            enemy.burstLeft -= 1;
            for (const off of [-0.22, 0, 0.22]) enemyShoot(state, enemy, aim + off, 260);
          }
        }
      }
    }

    // Drifters that fly past the bottom simply leave; anything else that exits
    // the bottom is removed without penalty.
    if (enemy.y > VIEW.height + 70 || enemy.x < -90 || enemy.x > VIEW.width + 90) {
      enemy.alive = false;
      if (enemy.kind === 'boss') state.boss = null;
    }
  }

  function applyPowerup(state, kind) {
    const p = state.player;
    if (kind === 'shield') {
      p.shield = POWERUP.shieldHits;
      addFloater(state, p.x, p.y - 30, 'SHIELD UP', '#4dd7ff', 18);
      world.events.push('shield-up');
    } else if (kind === 'spread') {
      p.spreadTimer = POWERUP.duration;
      addFloater(state, p.x, p.y - 30, 'SPREAD SHOT', '#ffd75e', 18);
      world.events.push('powerup');
    } else if (kind === 'rapid') {
      p.rapidTimer = POWERUP.duration;
      addFloater(state, p.x, p.y - 30, 'RAPID FIRE', '#ff9de2', 18);
      world.events.push('powerup');
    } else if (kind === 'life') {
      state.lives = Math.min(PLAYER.maxLives, state.lives + 1);
      addFloater(state, p.x, p.y - 30, '+1 LIFE', '#3dffc8', 18);
      world.events.push('powerup');
    }
  }

  function collide(state) {
    const p = state.player;
    // Player shots vs enemies.
    for (const shot of state.shots) {
      if (!shot.alive) continue;
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const dx = shot.x - enemy.x;
        const dy = shot.y - enemy.y;
        const rr = shot.radius + enemy.radius;
        if (dx * dx + dy * dy < rr * rr) {
          shot.alive = false;
          enemy.hp -= shot.damage;
          state.hits += 1;
          burst(state, shot.x, shot.y, '#ffe9a8', 4, 140, 2);
          if (enemy.hp <= 0) killEnemy(state, enemy);
          break;
        }
      }
    }
    if (!p.alive) return;
    // Enemy bullets vs player.
    for (const b of state.bullets) {
      if (!b.alive) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const rr = b.radius + PLAYER.radius * 0.8;
      if (dx * dx + dy * dy < rr * rr) {
        b.alive = false;
        damagePlayer(state);
        if (!p.alive) return;
      }
    }
    // Enemies ramming the player.
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const rr = enemy.radius + PLAYER.radius * 0.8;
      if (dx * dx + dy * dy < rr * rr) {
        enemy.hp -= 3;
        if (enemy.hp <= 0) killEnemy(state, enemy);
        damagePlayer(state);
        if (!p.alive) return;
      }
    }
    // Power-ups.
    for (const pu of state.powerups) {
      if (!pu.alive) continue;
      const dx = pu.x - p.x;
      const dy = pu.y - p.y;
      const rr = POWERUP.radius + PLAYER.radius;
      if (dx * dx + dy * dy < rr * rr) {
        pu.alive = false;
        applyPowerup(state, pu.kind);
      }
    }
  }

  world.startGame = function startGame() {
    world.reset();
    world.state.screen = SCREEN_PLAY;
    world.state.best = world.best || 0;
    startWave(world.state, 1);
  };

  // After the victory screen: keep playing past wave 10, bosses every 5 waves.
  world.continueEndless = function continueEndless() {
    const state = world.state;
    state.endless = true;
    state.screen = SCREEN_PLAY;
    state.waveActive = false;
    state.breather = 2.0;
    state.player.x = VIEW.width / 2;
    state.player.y = PLAYER.respawnY;
  };

  world.step = function step(dt, input) {
    const state = world.state;
    world.time += dt;
    world.events.length = 0;

    // Starfield always scrolls, on every screen.
    for (const star of world.stars) {
      star.y += star.speed * dt;
      if (star.y > VIEW.height + 2) {
        star.y = -2;
        star.x = rng() * VIEW.width;
      }
    }
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt * 1.4);

    if (state.screen !== SCREEN_PLAY) {
      // Particles and floaters still settle on end screens.
      updateParticles(state, dt);
      updateFloaters(state, dt);
      if (state.screen === SCREEN_OVER && !state.player.alive) {
        state.player.deathTimer -= dt;
      }
      return world.events;
    }

    const p = state.player;

    // Death sequence: the ship is gone, the world burns out, then game over.
    if (!p.alive) {
      p.deathTimer -= dt;
      updateParticles(state, dt);
      updateFloaters(state, dt);
      if (p.deathTimer <= 0) {
        state.floaters = [];
        state.screen = SCREEN_OVER;
        world.best = Math.max(world.best || 0, state.score);
        state.best = world.best;
      }
      return world.events;
    }

    // Timers.
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.spreadTimer = Math.max(0, p.spreadTimer - dt);
    p.rapidTimer = Math.max(0, p.rapidTimer - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // Movement + aim.
    p.x += input.mx * PLAYER.speed * dt;
    p.y += input.my * PLAYER.speed * dt;
    p.x = Math.max(PLAYER.radius, Math.min(VIEW.width - PLAYER.radius, p.x));
    p.y = Math.max(PLAYER.radius, Math.min(VIEW.height - PLAYER.radius, p.y));
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (input.fire) firePlayer(state);

    // Wave director.
    if (state.waveActive) {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = state.spawnQueue[state.spawnQueue.length - 1] === 'boss' ? 1.2 : 0.65;
          spawnEnemy(state, state.spawnQueue.pop());
        }
      } else if (state.enemies.length === 0 && !state.boss) {
        state.waveActive = false;
        const bonus = 250 * state.wave;
        state.score += bonus;
        addFloater(state, VIEW.width / 2, VIEW.height / 2 - 40, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd75e', 22);
        world.events.push(EVENT_WAVE_CLEAR);
        if (state.wave === VICTORY_WAVE && !state.endless) {
          state.floaters = [];
          state.screen = SCREEN_VICTORY;
          world.best = Math.max(world.best || 0, state.score);
          state.best = world.best;
          world.events.push(EVENT_VICTORY);
          return world.events;
        }
        state.breather = 2.5;
      }
    } else if (state.breather > 0) {
      state.breather -= dt;
      if (state.breather <= 0) startWave(state, state.wave + 1);
    }

    // Enemies, bullets, shots, power-ups.
    for (const enemy of state.enemies) updateEnemy(state, enemy, dt);
    state.enemies = state.enemies.filter((e) => e.alive);
    for (const shot of state.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.alive = shot.x > -20 && shot.x < VIEW.width + 20 && shot.y > -20 && shot.y < VIEW.height + 20;
    }
    state.shots = state.shots.filter((s) => s.alive);
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.alive = b.x > -30 && b.x < VIEW.width + 30 && b.y > -30 && b.y < VIEW.height + 30;
    }
    state.bullets = state.bullets.filter((b) => b.alive);
    for (const pu of state.powerups) {
      pu.y += pu.vy * dt;
      pu.t += dt;
      pu.alive = pu.y < VIEW.height + 20;
    }
    state.powerups = state.powerups.filter((u) => u.alive);

    collide(state);
    state.enemies = state.enemies.filter((e) => e.alive);
    state.shots = state.shots.filter((s) => s.alive);
    state.bullets = state.bullets.filter((b) => b.alive);
    state.powerups = state.powerups.filter((u) => u.alive);

    // Engine trail.
    if (rng() < 0.6) {
      state.particles.push({
        x: p.x - Math.cos(p.angle) * 16 + range(rng, -3, 3),
        y: p.y - Math.sin(p.angle) * 16 + range(rng, -3, 3),
        vx: -Math.cos(p.angle) * 60 + range(rng, -20, 20),
        vy: -Math.sin(p.angle) * 60 + range(rng, -20, 20),
        life: 0.35, maxLife: 0.35, size: 2.5, color: '#3dffc8', drag: 0.94,
      });
    }
    updateParticles(state, dt);
    updateFloaters(state, dt);
    return world.events;
  };

  function updateParticles(state, dt) {
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= pt.drag;
      pt.vy *= pt.drag;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  function updateFloaters(state, dt) {
    for (const f of state.floaters) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
  }

  return world;
}
