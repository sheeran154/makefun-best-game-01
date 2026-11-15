// VOIDSTRIKE — tuning constants. One place for every number that shapes the game,
// so balance lives here and nowhere else.
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

export const POWERUP = {
  dropChance: 0.13,
  fallSpeed: 90,
  radius: 13,
  duration: 12, // seconds for spread / rapid
  shieldHits: 3,
};

// Enemy kinds. Each has its own look, movement and attack in world.js.
export const ENEMY = {
  drifter:  { hp: 1, score: 100, radius: 16, speed: 70,  color: '#ff5d73' },
  stinger:  { hp: 2, score: 150, radius: 14, speed: 150, color: '#ffb02e' },
  weaver:   { hp: 3, score: 250, radius: 18, speed: 110, color: '#c26bff' },
  bulwark:  { hp: 8, score: 400, radius: 26, speed: 42,  color: '#4dd7ff' },
  boss:     { hp: 260, score: 5000, radius: 58, speed: 55, color: '#ff2e63' },
};

export const BOSS_WAVE_EVERY = 5;
export const VICTORY_WAVE = 10; // clearing the wave-10 boss wins the sector
export const COMBO_WINDOW = 2.5; // seconds between kills to keep the combo alive
export const COMBO_MAX = 8;

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
};

// Wave composition: how many of each kind a wave fields, before the boss (if any).
export function wavePlan(wave) {
  const n = 6 + wave * 2;
  const plan = [];
  const push = (kind, count) => { for (let i = 0; i < count; i += 1) plan.push(kind); };
  push('drifter', Math.max(2, Math.round(n * 0.45)));
  push('stinger', Math.round(n * 0.25));
  if (wave >= 2) push('weaver', Math.round(n * 0.2));
  if (wave >= 3) push('bulwark', Math.max(1, Math.round(n * 0.1)));
  return plan;
}
