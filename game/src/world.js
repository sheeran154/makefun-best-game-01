// VOIDSTRIKE v3 — the world: one object holding every moving thing, the wave
// director, collisions and scoring. It knows nothing about the canvas or the DOM;
// render.js draws whatever state it holds. All randomness flows through the
// seeded RNG, so a seed replays the same game exactly.
//
// v2 systems: a between-wave upgrade draft (pick 1 of 3 cards), a dash with
// i-frames, a screen-clearing bomb, two new enemy kinds (slicer, carrier that
// splits into drones), elite variants from wave 4, and a second phase for the
// wave-10 Void Maw.
//
// v3 systems: the Last Star beacon — a central objective. On siege waves
// (every 3rd wave and every boss wave) enemies hunt the beacon instead of the
// player; a ram costs the beacon hull, and at zero hull the run ends. Kills
// near the beacon earn a Guardian bonus.
import { VIEW, STEP, PLAYER, DASH, BOMB, POWERUP, ENEMY, ELITE_MIN_WAVE, ELITE_CHANCE, BOSS_WAVE_EVERY, VICTORY_WAVE, COMBO_WINDOW, COMBO_MAX, BEACON, SIEGE_EVERY, SECTOR_NAMES, UPGRADES, wavePlan } from './config.js';
import { mulberry32, range, pick, shuffle } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_UPGRADE = 'upgrade';

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

// Three depth layers of nebula blobs: far layers drift slowest and dimmest,
// near layers drift fastest and brightest — a parallax sky.
function makeNebulae(rng) {
  const hues = ['#3b0f6e', '#0f3a6e', '#6e0f3a', '#0f6e5a'];
  const blobs = [];
  const perLayer = [3, 3, 2];
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < perLayer[layer]; i += 1) {
      blobs.push({
        x: rng() * VIEW.width,
        y: rng() * VIEW.height,
        r: 180 + rng() * 220,
        color: hues[(layer * 2 + i) % hues.length],
        layer,
        speed: 5 + layer * 9,
        phase: rng() * TAU,
      });
    }
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
      dashes: 0,
      bombsUsed: 0,
      endless: false,
      waveActive: false,
      spawnQueue: [],
      spawnTimer: 0,
      breather: 0,
      boss: null,
      bossWarning: 0,
      banner: null,
      shake: 0,
      flash: 0,
      bombs: BOMB.startStock,
      bombsMax: BOMB.maxStock,
      upgradesPicked: [],
      upgradeDraft: null,
      // The Last Star beacon: the objective every siege wave hunts. Its hull
      // is a second life total for the run — at zero, the run ends.
      beacon: { x: BEACON.x, y: BEACON.y, radius: BEACON.radius, hp: BEACON.maxHp, maxHp: BEACON.maxHp },
      siege: false, // this wave's enemies hunt the beacon, not the player
      guardianKills: 0, // kills made close enough to the beacon to count
      overCause: null, // 'lives' | 'beacon' — named on the game-over screen
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
        dashCooldown: 0,
        dashTime: 0,
        dashDir: { x: 0, y: -1 },
        // Drafted upgrades, counted per pick. All stack; caps live in applyUpgrade.
        up: {
          damage: 0, firerate: 0, speed: 0, multishot: 0, pierce: 0,
          shield: 0, magnet: 0, bomb: 0, combo: 0, maxlife: 0,
        },
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

  // A dash afterimage: a fading ghost of the ship, drawn as a silhouette.
  function ghost(state, p) {
    state.particles.push({
      x: p.x, y: p.y,
      vx: 0, vy: 0,
      life: 0.32, maxLife: 0.32,
      size: 14, color: '#3dffc8',
      drag: 1, ghost: true, angle: p.angle,
    });
  }

  function startWave(state, wave) {
    state.wave = wave;
    state.waveActive = true;
    state.siege = wave % SIEGE_EVERY === 0 || wave % BOSS_WAVE_EVERY === 0;
    state.spawnQueue = shuffle(rng, wavePlan(wave));
    if (wave % BOSS_WAVE_EVERY === 0) state.spawnQueue.push('boss');
    state.spawnTimer = 0.4;
    const sector = SECTOR_NAMES[(wave - 1) % SECTOR_NAMES.length];
    if (wave % BOSS_WAVE_EVERY === 0) {
      state.banner = { text: '⚠ WARNING ⚠', sub: `VOID MAW APPROACHES — ${sector}`, t: 2.6, color: '#ff2e63' };
      world.events.push(EVENT_BOSS);
    } else if (state.siege) {
      state.banner = { text: `WAVE ${wave} — SIEGE`, sub: `${sector} · DEFEND THE LAST STAR`, t: 2.4, color: '#ffd75e' };
    } else {
      state.banner = { text: `WAVE ${wave}`, sub: wave === 1 ? `${sector} · HOSTILES INBOUND` : `${sector} · ${state.spawnQueue.length} HOSTILES`, t: 2.0, color: '#e8f6ff' };
    }
  }

  function makeEnemy(state, kind, x, y) {
    const def = ENEMY[kind];
    const enemy = {
      kind,
      x,
      y,
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
      elite: false,
      // Slicer charge state.
      charging: false,
      chargeT: 0,
      chargeTimer: range(rng, 0.8, 1.6),
      cvx: 0,
      cvy: 1,
      // Boss spiral state.
      spiralT: 0,
      spiralTimer: 0,
      spiralAngle: 0,
      // Fresh spawns cannot ram for a moment (carrier drones spawn on the player).
      spawnGrace: 0,
      alive: true,
      // On a siege wave this enemy hunts the beacon, not the player.
      siege: false,
    };
    if (kind === 'boss') {
      enemy.hp = def.hp + (state.wave - BOSS_WAVE_EVERY) * 40;
      enemy.maxHp = enemy.hp;
      state.boss = enemy;
      state.bossWarning = 1.6;
    } else if (state.wave >= ELITE_MIN_WAVE && rng() < ELITE_CHANCE) {
      // Elite: gold trim, 3x hull, 2x score, always drops a power-up.
      enemy.elite = true;
      enemy.hp *= 3;
      enemy.maxHp = enemy.hp;
      enemy.score *= 2;
    }
    // Siege waves send every non-boss enemy at the beacon. The boss still
    // hunts the player — it is too big to ram a star.
    if (kind !== 'boss') enemy.siege = state.siege;
    return enemy;
  }

  function spawnEnemy(state, kind) {
    const x = kind === 'boss' ? VIEW.width / 2 : range(rng, 50, VIEW.width - 50);
    const y = kind === 'boss' ? -80 : -40;
    state.enemies.push(makeEnemy(state, kind, x, y));
  }

  function dropPowerup(state, x, y, force = false) {
    if (!force && rng() >= POWERUP.dropChance) return;
    if (rng() < POWERUP.bombDropChance) {
      state.powerups.push({ x, y, kind: 'bomb', vy: POWERUP.fallSpeed, t: 0 });
      return;
    }
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
    const big = enemy.kind === 'boss' || enemy.kind === 'carrier';
    burst(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 140 : big ? 46 : 30, enemy.kind === 'boss' ? 420 : 280, enemy.kind === 'boss' ? 5 : 3);
    burst(state, enemy.x, enemy.y, '#ffffff', enemy.kind === 'boss' ? 16 : 8, 180, 2);
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.shake = Math.max(state.shake, 18);
      state.flash = 0.5;
    } else {
      state.shake = Math.max(state.shake, 4);
    }
    if (enemy.kind === 'carrier') {
      // The carrier splits into three fast drones that swarm the player.
      for (let i = -1; i <= 1; i += 1) {
        const d = makeEnemy(state, 'drone', enemy.x + i * 44, enemy.y + 24);
        d.spawnGrace = 0.4;
        state.enemies.push(d);
      }
    }
    if (awardScore) {
      const window = COMBO_WINDOW + state.player.up.combo;
      state.combo += 1;
      state.comboTimer = window;
      const mult = Math.min(state.combo, COMBO_MAX);
      let gained = enemy.score * mult;
      // Guardian bonus: a kill made close to the beacon is worth more — the
      // player was defending the objective, not just farming score.
      const nearBeacon = Math.hypot(enemy.x - state.beacon.x, enemy.y - state.beacon.y) < BEACON.guardianRadius;
      let guardian = 0;
      if (nearBeacon) {
        guardian = BEACON.guardianBonus * mult;
        gained += guardian;
        state.guardianKills += 1;
        world.events.push('guardian');
      }
      state.score += gained;
      state.kills += 1;
      addFloater(state, enemy.x, enemy.y, `+${gained}`, mult > 1 ? '#ffd75e' : '#e8f6ff', mult > 1 ? 19 : 15);
      if (guardian > 0) addFloater(state, enemy.x, enemy.y - 22, `GUARDIAN +${guardian}`, '#ffd75e', 15);
      else if (mult >= 4) addFloater(state, enemy.x, enemy.y - 22, `COMBO x${mult}`, '#ffd75e', 15);
      if (enemy.elite) addFloater(state, enemy.x, enemy.y + 22, 'ELITE DOWN', '#ffd75e', 15);
      dropPowerup(state, enemy.x, enemy.y, enemy.elite);
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
      state.overCause = 'lives';
      world.events.push(EVENT_GAME_OVER);
    } else {
      p.invulnerable = PLAYER.invulnerableSeconds;
      p.x = VIEW.width / 2;
      p.y = PLAYER.respawnY;
      p.spreadTimer = 0;
      p.rapidTimer = 0;
    }
  }

  // A besieger rammed the Last Star. At zero hull the beacon goes dark and
  // the run ends — a second way to lose, distinct from losing all lives.
  function damageBeacon(state) {
    const b = state.beacon;
    if (b.hp <= 0) return;
    b.hp -= BEACON.ramDamage;
    state.shake = Math.max(state.shake, 10);
    burst(state, b.x, b.y, '#ffd75e', 22, 260, 3);
    addFloater(state, b.x, b.y - 44, 'BEACON HIT', '#ffd75e', 17);
    world.events.push('beacon-hit');
    if (b.hp <= 0) {
      b.hp = 0;
      state.shake = Math.max(state.shake, 20);
      state.flash = 0.6;
      burst(state, b.x, b.y, '#ffd75e', 90, 420, 5);
      burst(state, b.x, b.y, '#ffffff', 24, 300, 3);
      state.player.alive = false;
      state.player.deathTimer = 1.4;
      state.overCause = 'beacon';
      world.events.push('beacon-down');
      world.events.push(EVENT_GAME_OVER);
    }
  }

  function firePlayer(state) {
    const p = state.player;
    const interval = Math.max(
      0.06,
      (p.rapidTimer > 0 ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval) * Math.pow(0.88, p.up.firerate),
    );
    if (p.fireCooldown > 0) return;
    p.fireCooldown = interval;
    const extra = p.up.multishot + (p.spreadTimer > 0 ? 2 : 0);
    const count = 1 + extra;
    const base = p.angle;
    for (let i = 0; i < count; i += 1) {
      const off = (i - (count - 1) / 2) * 0.14;
      const a = base + off;
      state.shots.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * PLAYER.bulletSpeed,
        vy: Math.sin(a) * PLAYER.bulletSpeed,
        damage: PLAYER.bulletDamage + p.up.damage,
        radius: 4,
        pierce: p.up.pierce,
        hitSet: new Set(),
        alive: true,
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
      alive: true,
    });
    world.events.push('enemy-shoot');
  }

  function detonateBomb(state) {
    const p = state.player;
    if (state.bombs <= 0 || !p.alive) return;
    state.bombs -= 1;
    state.bombsUsed += 1;
    for (const b of state.bullets) {
      if (!b.alive) continue;
      b.alive = false;
      burst(state, b.x, b.y, '#ff4d6d', 2, 120, 2);
    }
    // Snapshot: killing a carrier spawns drones, and they must not eat bomb damage.
    for (const enemy of [...state.enemies]) {
      if (!enemy.alive) continue;
      enemy.hp -= BOMB.damage;
      if (enemy.hp <= 0) killEnemy(state, enemy);
    }
    state.shake = Math.max(state.shake, 20);
    state.flash = 0.6;
    burst(state, p.x, p.y, '#ffd75e', 40, 420, 4);
    world.events.push('bomb');
  }

  function updateEnemy(state, enemy, dt) {
    const p = state.player;
    enemy.t += dt;
    enemy.fireTimer -= dt;
    enemy.spawnGrace = Math.max(0, enemy.spawnGrace - dt);
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aim = Math.atan2(dy, dx);
    // The hunt target: the player, unless this enemy is besieging — then it
    // steers at the beacon. Shots are still aimed at the player (bullets
    // cannot hurt a star); only movement and rams follow the hunt target.
    const tdx = (enemy.siege ? state.beacon.x : p.x) - enemy.x;
    const tdy = (enemy.siege ? state.beacon.y : p.y) - enemy.y;
    const tdist = Math.hypot(tdx, tdy) || 1;

    if (enemy.kind === 'drifter') {
      enemy.y += ENEMY.drifter.speed * dt;
      enemy.x += Math.sin(enemy.t * 2.2) * 55 * dt;
      if (enemy.siege) enemy.x += (tdx / tdist) * 40 * dt;
    } else if (enemy.kind === 'stinger') {
      enemy.y += ENEMY.stinger.speed * dt;
      enemy.x += (tdx / tdist) * 90 * dt;
      if (enemy.fireTimer <= 0 && enemy.y > 0 && enemy.y < VIEW.height * 0.75) {
        enemy.fireTimer = 2.3;
        enemyShoot(state, enemy, aim + range(rng, -0.08, 0.08));
      }
    } else if (enemy.kind === 'weaver') {
      enemy.y += ENEMY.weaver.speed * dt;
      enemy.x += Math.sin(enemy.t * 3.1) * 190 * dt;
      if (enemy.siege) enemy.x += (tdx / tdist) * 55 * dt;
      if (enemy.fireTimer <= 0 && enemy.y > 0 && enemy.y < VIEW.height * 0.7) {
        enemy.fireTimer = 2.8;
        for (const off of [-0.28, 0, 0.28]) enemyShoot(state, enemy, aim + off, 210);
      }
    } else if (enemy.kind === 'bulwark') {
      // Besieging bulwarks hover lower, closer to the beacon, and drift
      // toward it while they fire at the player.
      const hoverY = enemy.siege ? 220 : 130;
      if (enemy.y < hoverY) {
        enemy.y += ENEMY.bulwark.speed * dt;
      } else {
        enemy.x += Math.sin(enemy.t * 0.9) * 60 * dt;
        if (enemy.siege) enemy.x += (tdx / tdist) * 45 * dt;
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
    } else if (enemy.kind === 'slicer') {
      // Fast zigzag descent, then a telegraphed charge straight at the player.
      if (enemy.charging) {
        enemy.chargeT -= dt;
        enemy.x += enemy.cvx * 520 * dt;
        enemy.y += enemy.cvy * 520 * dt;
        if (enemy.chargeT <= 0) {
          enemy.charging = false;
          enemy.chargeTimer = 1.6;
        }
      } else {
        enemy.y += ENEMY.slicer.speed * dt;
        enemy.x += Math.sin(enemy.t * 6) * 260 * dt;
        enemy.chargeTimer -= dt;
        if (enemy.chargeTimer <= 0 && enemy.y > 40 && enemy.y < 420 && p.alive) {
          enemy.charging = true;
          enemy.chargeT = 0.5;
          enemy.cvx = tdx / tdist;
          enemy.cvy = tdy / tdist;
          world.events.push('enemy-shoot');
        }
      }
    } else if (enemy.kind === 'carrier') {
      // Slow freighter that hovers and lobs aimed shots; splits on death.
      // Besieging carriers hover lower, nearer the beacon.
      const hoverY = enemy.siege ? 200 : 110;
      if (enemy.y < hoverY) {
        enemy.y += ENEMY.carrier.speed * dt;
      } else {
        enemy.x += Math.sin(enemy.t * 0.8) * 50 * dt;
        if (enemy.siege) enemy.x += (tdx / tdist) * 40 * dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = 2.6;
          enemyShoot(state, enemy, aim + range(rng, -0.05, 0.05), 220);
        }
      }
    } else if (enemy.kind === 'drone') {
      // Carrier shrapnel: small, fast, homes in and rams. Besieging drones
      // home on the beacon instead of the player.
      if (enemy.siege) {
        enemy.y += (tdy / tdist) * 200 * dt;
        enemy.x += (tdx / tdist) * 200 * dt;
      } else {
        enemy.y += 90 * dt;
        enemy.x += (dx / dist) * 150 * dt;
      }
    } else if (enemy.kind === 'boss') {
      // Phase 2 below half health: faster, a spiral barrage, elite summons.
      if (enemy.phase === 0 && enemy.hp <= enemy.maxHp * 0.5) {
        enemy.phase = 1;
        enemy.attackTimer = 1.2;
        state.banner = { text: 'VOID MAW ENRAGED', sub: 'PHASE 2 — SPIRAL BARRAGE', t: 2.2, color: '#ff2e63' };
        burst(state, enemy.x, enemy.y, '#ff2e63', 40, 380, 4);
        world.events.push('boss-phase2');
      }
      const phase2 = enemy.phase === 1;
      if (enemy.y < 120) {
        enemy.y += 60 * dt;
      } else {
        enemy.x += Math.sin(enemy.t * 0.7) * (phase2 ? 150 : 110) * dt;
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          const cycle = phase2 ? 4 : 3;
          enemy.attack = (enemy.attack + 1) % cycle;
          enemy.attackTimer = (enemy.attack === 2 ? 4.5 : 3.4) * (phase2 ? 0.6 : 1);
          if (enemy.attack === 0) {
            // Radial burst.
            for (let i = 0; i < 16; i += 1) enemyShoot(state, enemy, (i / 16) * TAU, 190);
            world.events.push('boss-attack');
          } else if (enemy.attack === 1) {
            enemy.burstLeft = 5;
            enemy.burstTimer = 0;
          } else if (enemy.attack === 2) {
            // Summon minions — elites in phase 2.
            for (let i = 0; i < 3; i += 1) {
              const m = makeEnemy(state, 'drifter', enemy.x + (i - 1) * 90, enemy.y + 50);
              if (phase2) {
                m.elite = true;
                m.hp *= 3;
                m.maxHp = m.hp;
                m.score *= 2;
              }
              state.enemies.push(m);
            }
            world.events.push('boss-attack');
          } else {
            // Spiral barrage: a rotating double stream of bullets.
            enemy.spiralT = 2.8;
            enemy.spiralTimer = 0;
            enemy.spiralAngle = rng() * TAU;
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
        if (enemy.attack === 3 && enemy.spiralT > 0) {
          enemy.spiralT -= dt;
          enemy.spiralTimer -= dt;
          if (enemy.spiralTimer <= 0) {
            enemy.spiralTimer = 0.07;
            enemyShoot(state, enemy, enemy.spiralAngle, 200);
            enemyShoot(state, enemy, enemy.spiralAngle + Math.PI, 200);
            enemy.spiralAngle += 0.45;
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
      state.lives = Math.min(PLAYER.maxLives + p.up.maxlife, state.lives + 1);
      addFloater(state, p.x, p.y - 30, '+1 LIFE', '#3dffc8', 18);
      world.events.push('powerup');
    } else if (kind === 'bomb') {
      state.bombs = Math.min(state.bombsMax, state.bombs + 1);
      addFloater(state, p.x, p.y - 30, '+1 BOMB', '#ff2e63', 18);
      world.events.push('powerup');
    }
  }

  function rollDraft(state) {
    return shuffle(rng, [...UPGRADES]).slice(0, 3);
  }

  // Apply one drafted upgrade, then hand the game back to the next wave.
  world.applyUpgrade = function applyUpgrade(index) {
    const state = world.state;
    if (!state.upgradeDraft) return false;
    const option = state.upgradeDraft.options[index];
    if (!option) return false;
    const p = state.player;
    const up = p.up;
    switch (option.id) {
      case 'damage': up.damage += 1; break;
      case 'firerate': up.firerate += 1; break;
      case 'speed': up.speed = Math.min(5, up.speed + 1); break;
      case 'multishot': up.multishot = Math.min(3, up.multishot + 1); break;
      case 'pierce': up.pierce = Math.min(3, up.pierce + 1); break;
      case 'shield':
        up.shield += 1;
        p.shield = Math.min(up.shield, p.shield + 1);
        break;
      case 'magnet': up.magnet += 1; break;
      case 'bomb':
        state.bombsMax += 1;
        state.bombs = Math.min(state.bombsMax, state.bombs + 2);
        break;
      case 'combo': up.combo += 1; break;
      case 'maxlife':
        up.maxlife = Math.min(2, up.maxlife + 1);
        state.lives = Math.min(PLAYER.maxLives + up.maxlife, state.lives + 1);
        break;
      default: break;
    }
    state.upgradesPicked.push(option.id);
    addFloater(state, VIEW.width / 2, VIEW.height / 2 - 60, `${option.name} ACQUIRED`, option.color, 22);
    state.upgradeDraft = null;
    state.screen = SCREEN_PLAY;
    state.breather = 2.0;
    world.events.push('upgrade');
    return true;
  };

  function collide(state) {
    const p = state.player;
    // Player shots vs enemies (piercing shots keep flying through extras).
    for (const shot of state.shots) {
      if (!shot.alive) continue;
      for (const enemy of state.enemies) {
        if (!enemy.alive || shot.hitSet.has(enemy)) continue;
        const dx = shot.x - enemy.x;
        const dy = shot.y - enemy.y;
        const rr = shot.radius + enemy.radius;
        if (dx * dx + dy * dy < rr * rr) {
          enemy.hp -= shot.damage;
          state.hits += 1;
          burst(state, shot.x, shot.y, '#ffe9a8', 4, 140, 2);
          if (shot.pierce > 0) {
            shot.pierce -= 1;
            shot.hitSet.add(enemy);
          } else {
            shot.alive = false;
          }
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
    // Enemies ramming the player (fresh carrier drones get a grace moment).
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy.spawnGrace > 0) continue;
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
    // Besiegers ramming the Last Star: the rammer takes the hit, the beacon
    // loses hull, and at zero hull the run is over. Only besieging enemies
    // hurt it — a normal wave's drifters just fly past the light.
    if (state.beacon.hp > 0) {
      for (const enemy of state.enemies) {
        if (!enemy.alive || !enemy.siege) continue;
        const dx = enemy.x - state.beacon.x;
        const dy = enemy.y - state.beacon.y;
        const rr = enemy.radius + state.beacon.radius;
        if (dx * dx + dy * dy < rr * rr) {
          enemy.hp -= BEACON.enemyRamDamage;
          if (enemy.hp <= 0) killEnemy(state, enemy);
          damageBeacon(state);
          if (state.beacon.hp <= 0) return;
        }
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

    // Starfield and nebulae always scroll, on every screen.
    for (const star of world.stars) {
      star.y += star.speed * dt;
      if (star.y > VIEW.height + 2) {
        star.y = -2;
        star.x = rng() * VIEW.width;
      }
    }
    for (const neb of world.nebulae) {
      neb.y += neb.speed * dt;
      if (neb.y - neb.r > VIEW.height) {
        neb.y = -neb.r;
        neb.x = rng() * VIEW.width;
      }
    }
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt * 1.4);

    if (state.screen !== SCREEN_PLAY) {
      // Particles and floaters still settle on end screens and the draft.
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
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.bossWarning > 0) state.bossWarning -= dt;

    // Dash: a burst in the move direction (or the aim direction when still),
    // with brief invulnerability and ghost afterimages.
    if (input.dash && p.dashCooldown <= 0) {
      p.dashCooldown = DASH.cooldown;
      p.dashTime = DASH.duration;
      p.invulnerable = Math.max(p.invulnerable, DASH.iframes);
      let dx = input.mx;
      let dy = input.my;
      if (dx === 0 && dy === 0) {
        dx = input.aimX - p.x;
        dy = input.aimY - p.y;
      }
      const len = Math.hypot(dx, dy) || 1;
      p.dashDir = { x: dx / len, y: dy / len };
      state.dashes += 1;
      ghost(state, p);
      world.events.push('dash');
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
      const speed = PLAYER.speed * (1 + 0.12 * p.up.speed) * DASH.speedMult;
      p.x += p.dashDir.x * speed * dt;
      p.y += p.dashDir.y * speed * dt;
      p.x = Math.max(PLAYER.radius, Math.min(VIEW.width - PLAYER.radius, p.x));
      p.y = Math.max(PLAYER.radius, Math.min(VIEW.height - PLAYER.radius, p.y));
      ghost(state, p);
    } else {
      // Movement + aim.
      const speed = PLAYER.speed * (1 + 0.12 * p.up.speed);
      p.x += input.mx * speed * dt;
      p.y += input.my * speed * dt;
      p.x = Math.max(PLAYER.radius, Math.min(VIEW.width - PLAYER.radius, p.x));
      p.y = Math.max(PLAYER.radius, Math.min(VIEW.height - PLAYER.radius, p.y));
    }
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (input.fire) firePlayer(state);
    if (input.bomb) detonateBomb(state);

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
        // The beacon mends a little of its hull between waves.
        if (state.beacon.hp < state.beacon.maxHp) {
          state.beacon.hp = Math.min(state.beacon.maxHp, state.beacon.hp + BEACON.repairPerWave);
          addFloater(state, state.beacon.x, state.beacon.y - 52, `BEACON MENDED +${BEACON.repairPerWave}`, '#ffd75e', 15);
        }
        if (state.wave === VICTORY_WAVE && !state.endless) {
          state.floaters = [];
          state.screen = SCREEN_VICTORY;
          world.best = Math.max(world.best || 0, state.score);
          state.best = world.best;
          world.events.push(EVENT_VICTORY);
          return world.events;
        }
        // Aegis plating recharges one shield between waves.
        if (p.up.shield > 0) p.shield = Math.min(p.up.shield, p.shield + 1);
        // Between-wave upgrade draft: the action pauses until a card is picked.
        state.upgradeDraft = { options: rollDraft(state) };
        state.screen = SCREEN_UPGRADE;
        world.events.push('draft');
        return world.events;
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
      // Tractor web pulls nearby power-ups toward the ship.
      if (p.up.magnet > 0) {
        const dx = p.x - pu.x;
        const dy = p.y - pu.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 300) {
          pu.x += (dx / d) * 320 * dt;
          pu.y += (dy / d) * 320 * dt;
          pu.t += dt;
          pu.alive = pu.y < VIEW.height + 20;
          continue;
        }
      }
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
