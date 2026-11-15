// VOIDSTRIKE — every sound is synthesized with WebAudio. No audio files, no
// network: oscillators and filtered noise, built on the first user gesture.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.32;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone({ type = 'square', from = 440, to = null, dur = 0.12, vol = 0.5, when = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.5, freq = 1200, when = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.15), t0 + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export const sfx = {
  shoot() { tone({ type: 'square', from: 880, to: 220, dur: 0.09, vol: 0.22 }); },
  enemyShoot() { tone({ type: 'sawtooth', from: 320, to: 140, dur: 0.12, vol: 0.1 }); },
  explosion(big = false) {
    noise({ dur: big ? 0.7 : 0.35, vol: big ? 0.7 : 0.4, freq: big ? 900 : 1600 });
    tone({ type: 'sine', from: big ? 160 : 220, to: 40, dur: big ? 0.6 : 0.3, vol: 0.5 });
  },
  hit() {
    tone({ type: 'sawtooth', from: 200, to: 60, dur: 0.25, vol: 0.5 });
    noise({ dur: 0.2, vol: 0.3, freq: 800 });
  },
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.12, vol: 0.35, when: i * 0.07 }));
  },
  shieldUp() { tone({ type: 'sine', from: 300, to: 900, dur: 0.25, vol: 0.35 }); },
  waveClear() {
    [392, 523, 659].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.16, vol: 0.3, when: i * 0.09 }));
  },
  bossAlarm() {
    tone({ type: 'square', from: 220, to: 220, dur: 0.18, vol: 0.3 });
    tone({ type: 'square', from: 220, to: 220, dur: 0.18, vol: 0.3, when: 0.28 });
    tone({ type: 'square', from: 330, to: 330, dur: 0.3, vol: 0.3, when: 0.56 });
  },
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.35, when: i * 0.11 }));
  },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', from: f, dur: 0.3, vol: 0.25, when: i * 0.16 }));
  },
  click() { tone({ type: 'sine', from: 700, to: 500, dur: 0.06, vol: 0.25 }); },
  // v2: a short airy whoosh for the dash.
  dash() {
    noise({ dur: 0.18, vol: 0.35, freq: 3200 });
    tone({ type: 'sine', from: 300, to: 900, dur: 0.14, vol: 0.15 });
  },
  // v2: a deep detonation for the bomb.
  bomb() {
    noise({ dur: 0.8, vol: 0.8, freq: 700 });
    tone({ type: 'sine', from: 120, to: 30, dur: 0.7, vol: 0.7 });
    tone({ type: 'square', from: 55, to: 40, dur: 0.5, vol: 0.3, when: 0.05 });
  },
  // v2: a bright rising arpeggio when an upgrade is drafted.
  upgrade() {
    [440, 554, 659, 880, 1109].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.14, vol: 0.32, when: i * 0.06 }));
  },
  // v2: the boss's second-phase alarm — two rising wails.
  phase2() {
    tone({ type: 'sawtooth', from: 180, to: 520, dur: 0.35, vol: 0.3 });
    tone({ type: 'sawtooth', from: 180, to: 520, dur: 0.35, vol: 0.3, when: 0.4 });
  },
};
