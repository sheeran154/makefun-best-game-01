// VOIDSTRIKE v3 — tuning constants. One place for every number that shapes the
// game, so balance lives here and nowhere else.
//
// v3 systems: the Last Star beacon — a central objective enemies besiege on
// every 3rd wave and on boss waves. Kill foes near it for a Guardian bonus;
// if its hull hits zero, the run ends.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 340,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletDamage: 1,
  maxLives: 3,
  invulnerableSeconds: 2.0,
  respawnY: 600,
};

// Dash: a short burst of speed with brief invulnerability, on a cooldown.
export const DASH = {
  cooldown: 2.5, // seconds between dashes
  duration: 0.18, // seconds the burst lasts
  speedMult: 3.2, // burst speed as a multiple of flight speed
  iframes: 0.35, // invulnerability granted by the dash
};

// Bomb: clears every enemy bullet and hurts everything on screen.
export const BOMB = {
  startStock: 1,
  maxStock: 3,
  damage: 6,
};

export const POWERUP = {
  dropChance: 0.13,
  fallSpeed: 90,
  radius: 13,
  duration: 12, // seconds for spread / rapid
  shieldHits: 3,
  bombDropChance: 0.12, // share of drops that are a bomb restock
};

// Enemy kinds. Each has its own look, movement and attack in world.js.
export const ENEMY = {
  drifter:  { hp: 1, score: 100, radius: 16, speed: 70,  color: '#ff5d73' },
  stinger:  { hp: 2, score: 150, radius: 14, speed: 150, color: '#ffb02e' },
  weaver:   { hp: 3, score: 250, radius: 18, speed: 110, color: '#c26bff' },
  bulwark:  { hp: 8, score: 400, radius: 26, speed: 42,  color: '#4dd7ff' },
  slicer:   { hp: 2, score: 200, radius: 15, speed: 120, color: '#ff7a3d' },
  carrier:  { hp: 6, score: 350, radius: 24, speed: 55,  color: '#ff9de2' },
  drone:    { hp: 1, score: 50,  radius: 10, speed: 200, color: '#ff9de2' },
  boss:     { hp: 260, score: 5000, radius: 58, speed: 55, color: '#ff2e63' },
};

// Elites: from this wave on, a spawn can be elite — 3x HP, 2x score, gold
// trim, and it always drops a power-up.
export const ELITE_MIN_WAVE = 4;
export const ELITE_CHANCE = 0.12;

export const BOSS_WAVE_EVERY = 5;
export const VICTORY_WAVE = 10; // clearing the wave-10 boss wins the sector
export const COMBO_WINDOW = 2.5; // seconds between kills to keep the combo alive
export const COMBO_MAX = 8;

// The Last Star: the beacon every siege wave tries to kill. It sits near the
// middle of the field and glows warm gold; enemies with an ember ring are
// besieging it right now.
export const BEACON = {
  x: 640,
  y: 330,
  radius: 26,
  maxHp: 12,
  guardianRadius: 260, // kills this close to the beacon earn the bonus
  guardianBonus: 100, // flat bonus score per nearby kill, times the combo
  ramDamage: 1, // hull lost when a besieger rams the beacon
  enemyRamDamage: 3, // damage the rammer takes for the hit
  repairPerWave: 2, // hull mended on every wave clear
};

// Siege waves: every 3rd wave, plus every boss wave. On a siege wave every
// non-boss enemy hunts the beacon instead of the player.
export const SIEGE_EVERY = 3;

// Sector names, shown in the wave banner so every wave has a place.
export const SECTOR_NAMES = [
  'THE RIFT GATE', 'THE DIMMING', 'THE LONG NIGHT', 'THE EMBER REACH',
  'THE HOLLOW', 'THE LAST LIGHT', 'THE DUSK FIELD', 'THE QUIET',
  'THE PALE MARCH', 'THE DAWN',
];

export const COLORS = {
  bg0: '#05010f',
  bg1: '#0d0221',
  player: '#3dffc8',
  playerCore: '#eafff8',
  bullet: '#8dff5e',
  enemyBullet: '#ff4d6d',
  text: '#e8f6ff',
  dim: '#8fa8c8',
  gold: '#ffd75e',
  danger: '#ff2e63',
  elite: '#ffd75e',
  beacon: '#ffd75e',
  ember: '#ff6a2a',
};

// The upgrade draft pool. Every entry stacks when picked again; the caps live
// in world.js where the pick is applied.
export const UPGRADES = [
  { id: 'damage',   glyph: '▲', color: '#ff5d73', name: 'HEAVY ROUNDS',     desc: '+1 bullet damage' },
  { id: 'firerate', glyph: '≫', color: '#ffb02e', name: 'OVERCLOCK',        desc: 'Fire 12% faster' },
  { id: 'speed',    glyph: '»', color: '#3dffc8', name: 'ION THRUSTERS',    desc: '+12% flight speed' },
  { id: 'multishot', glyph: '✳', color: '#8dff5e', name: 'SPLIT SHOT',      desc: '+1 projectile per volley' },
  { id: 'pierce',   glyph: '⇢', color: '#c26bff', name: 'PIERCING ROUNDS',  desc: 'Shots pierce +1 enemy' },
  { id: 'shield',   glyph: '⬡', color: '#4dd7ff', name: 'AEGIS PLATING',    desc: '+1 shield, recharges each wave' },
  { id: 'magnet',   glyph: '◎', color: '#ffd75e', name: 'TRACTOR WEB',      desc: 'Power-ups fly to you' },
  { id: 'bomb',     glyph: '✸', color: '#ff2e63', name: 'BOMB RACK',        desc: '+2 bombs, +1 max stock' },
  { id: 'combo',    glyph: '×', color: '#ff9de2', name: 'COMBO EXTENDER',   desc: '+1s combo window' },
  { id: 'maxlife',  glyph: '♥', color: '#3dffc8', name: 'REINFORCED HULL',  desc: '+1 max life, heal 1 now' },
];

// Wave composition: how many of each kind a wave fields, before the boss (if any).
export function wavePlan(wave) {
  const n = 6 + wave * 2;
  const plan = [];
  const push = (kind, count) => { for (let i = 0; i < count; i += 1) plan.push(kind); };
  push('drifter', Math.max(2, Math.round(n * 0.38)));
  push('stinger', Math.round(n * 0.22));
  if (wave >= 2) {
    push('weaver', Math.round(n * 0.16));
    push('slicer', Math.round(n * 0.14));
  }
  if (wave >= 3) push('bulwark', Math.max(1, Math.round(n * 0.08)));
  if (wave >= 4) push('carrier', Math.max(1, Math.round(n * 0.06)));
  return plan;
}
