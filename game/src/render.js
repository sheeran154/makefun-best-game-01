// VOIDSTRIKE v2 — every pixel the player sees. It draws only what world.js holds:
// the parallax nebula sky, the ships, the bullets, the HUD, the upgrade draft
// and the menu screens. No game logic lives here; change a look without
// touching a rule.
import { VIEW, PLAYER, POWERUP, ENEMY, COLORS, UPGRADES, DASH } from './config.js';
import { SCREEN_TITLE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_VICTORY, SCREEN_UPGRADE } from './world.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawShip(ctx, x, y, angle, scale, color, core) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.scale(scale, scale);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(13, 12);
  ctx.lineTo(5, 7);
  ctx.lineTo(0, 10);
  ctx.lineTo(-5, 7);
  ctx.lineTo(-13, 12);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = core;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -2, 4, 0, TAU);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
}

// The three upgrade cards, laid out once here so the click handler in main.js
// can test the same rectangles.
export function draftCardRects() {
  const w = 300;
  const h = 300;
  const gap = 24;
  const x0 = (VIEW.width - (w * 3 + gap * 2)) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y: 210, w, h }));
}

// Distinct upgrades the run has picked, in pick order, with stack counts.
function upgradeChips(state) {
  const counts = new Map();
  for (const id of state.upgradesPicked) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts.entries()].map(([id, count]) => {
    const def = UPGRADES.find((u) => u.id === id);
    return { glyph: def.glyph, color: def.color, name: def.name, count };
  });
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const pulse = 1 + Math.sin(time * 6 + e.t) * 0.08;
  ctx.scale(pulse, pulse);
  ctx.lineWidth = 2;
  ctx.strokeStyle = e.color;
  ctx.fillStyle = e.color;
  if (e.kind === 'drifter') {
    ctx.rotate(Math.sin(e.t) * 0.3);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (e.kind === 'stinger') {
    ctx.rotate(Math.atan2(e.vy || 1, e.vx || 0) + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -e.radius);
    ctx.lineTo(e.radius * 0.8, e.radius * 0.7);
    ctx.lineTo(0, e.radius * 0.3);
    ctx.lineTo(-e.radius * 0.8, e.radius * 0.7);
    ctx.closePath();
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (e.kind === 'weaver') {
    ctx.rotate(e.t * 1.5);
    ctx.beginPath();
    ctx.moveTo(0, -e.radius);
    ctx.lineTo(e.radius, 0);
    ctx.lineTo(0, e.radius);
    ctx.lineTo(-e.radius, 0);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (e.kind === 'bulwark') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, TAU);
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.55, 0, TAU);
    ctx.strokeStyle = e.color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // HP ticks around the hull.
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 6, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (e.kind === 'slicer') {
    // A swept orange dart; white-hot while it charges at the player.
    ctx.rotate(Math.sin(e.t * 6) * 0.25);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius - 6);
    ctx.lineTo(e.radius * 0.55, e.radius * 0.4);
    ctx.lineTo(e.radius * 1.25, e.radius * 0.9);
    ctx.lineTo(0, e.radius * 0.45);
    ctx.lineTo(-e.radius * 1.25, e.radius * 0.9);
    ctx.lineTo(-e.radius * 0.55, e.radius * 0.4);
    ctx.closePath();
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (e.charging) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, -2, 4, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  } else if (e.kind === 'carrier') {
    // A heavy pink freighter: hexagon hull, three glowing pods inside.
    ctx.rotate(Math.sin(e.t * 0.8) * 0.1);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const [ox, oy] of [[-9, -5], [9, -5], [0, 9]]) {
      ctx.beginPath();
      ctx.arc(ox, oy, 4.5, 0, TAU);
      ctx.fill();
    }
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 6, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (e.kind === 'drone') {
    // Carrier shrapnel: a small fast pink diamond.
    ctx.rotate(e.t * 4);
    ctx.beginPath();
    ctx.moveTo(0, -e.radius);
    ctx.lineTo(e.radius * 0.8, 0);
    ctx.lineTo(0, e.radius);
    ctx.lineTo(-e.radius * 0.8, 0);
    ctx.closePath();
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (e.kind === 'boss') {
    const phase2 = e.phase === 1;
    const wob = Math.sin(time * 2) * 0.05;
    ctx.rotate(wob);
    const ringColor = phase2 ? '#ff004c' : e.color;
    const spikeLen = e.radius + (phase2 ? 24 : 16);
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 26;
    // Outer ring.
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, TAU);
    ctx.fillStyle = '#2a0218';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = ringColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Spikes.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + time * (phase2 ? 0.9 : 0.4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.85, Math.sin(a) * e.radius * 0.85);
      ctx.lineTo(Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
      ctx.lineTo(Math.cos(a + 0.2) * e.radius * 0.85, Math.sin(a + 0.2) * e.radius * 0.85);
      ctx.closePath();
      ctx.fillStyle = ringColor;
      ctx.fill();
    }
    // Core eye.
    const eyeR = 16 + Math.sin(time * (phase2 ? 9 : 5)) * 3;
    ctx.beginPath();
    ctx.arc(0, 0, eyeR, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, eyeR * 0.55, 0, TAU);
    ctx.fillStyle = phase2 ? '#ff004c' : '#ff2e63';
    ctx.fill();
    if (phase2) {
      // Rotating fury arcs in phase 2.
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ff004c';
      for (const off of [0, Math.PI]) {
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 18, time * 2 + off, time * 2 + off + 1.4);
        ctx.stroke();
      }
    }
    // HP ring.
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  // Elites wear a gold ring so they read at a glance.
  if (e.elite && e.kind !== 'boss') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 7, 0, TAU);
    ctx.strokeStyle = COLORS.elite;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, e.hp / e.maxHp));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPowerup(ctx, pu, time) {
  const bob = Math.sin(time * 4 + pu.t * 2) * 3;
  const y = pu.y + bob;
  ctx.save();
  ctx.translate(pu.x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(0, 0, POWERUP.radius + 6 + Math.sin(time * 5) * 2, 0, TAU);
  ctx.fillStyle = pu.kind === 'bomb' ? 'rgba(255, 46, 99, 0.16)' : 'rgba(255, 215, 94, 0.12)';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.arc(0, 0, POWERUP.radius, 0, TAU);
  ctx.fillStyle = '#0d0221';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = pu.kind === 'bomb' ? '#ff2e63' : '#ffd75e';
  ctx.stroke();
  ctx.fillStyle = pu.kind === 'bomb' ? '#ff2e63' : '#ffd75e';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyph = { shield: 'S', spread: 'W', rapid: 'R', life: '+', bomb: 'B' }[pu.kind];
  ctx.fillText(glyph, 0, 1);
  ctx.restore();
}

function drawBackground(ctx, world, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, COLORS.bg0);
  grad.addColorStop(1, COLORS.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Parallax nebula: far layers dim and slow, near layers bright and fast.
  for (let layer = 0; layer < 3; layer += 1) {
    for (const neb of world.nebulae) {
      if (neb.layer !== layer) continue;
      const sway = Math.sin(time * 0.05 + neb.phase) * (8 + layer * 10);
      const g = ctx.createRadialGradient(neb.x + sway, neb.y, 0, neb.x + sway, neb.y, neb.r);
      const alpha = ['22', '2e', '38'][layer];
      g.addColorStop(0, neb.color + alpha);
      g.addColorStop(1, neb.color + '00');
      ctx.fillStyle = g;
      ctx.fillRect(neb.x + sway - neb.r, neb.y - neb.r, neb.r * 2, neb.r * 2);
    }
  }
  for (const star of world.stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * 2 + star.phase);
    ctx.globalAlpha = tw * (0.35 + star.layer * 0.25);
    ctx.fillStyle = star.layer === 2 ? '#cfe8ff' : '#ffffff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const s = world.state;
  ctx.save();
  ctx.textBaseline = 'top';
  // Score.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(s.score).padStart(7, '0')}`, 20, 14);
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`BEST ${String(Math.max(s.best, s.score)).padStart(7, '0')}`, 20, 46);
  // Wave.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`WAVE ${s.wave}`, VIEW.width / 2, 16);
  // Lives as little ships.
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('LIVES', VIEW.width - 20, 16);
  for (let i = 0; i < s.lives; i += 1) {
    drawShip(ctx, VIEW.width - 36 - i * 30, 52, 0, 0.85, COLORS.player, COLORS.playerCore);
  }
  // Shield pips.
  if (s.player.shield > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4dd7ff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`SHIELD ${'◆'.repeat(s.player.shield)}`, VIEW.width - 20, 78);
  }
  // Combo.
  if (s.combo >= 2) {
    const mult = Math.min(s.combo, 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`COMBO x${mult}`, 20, 72);
    ctx.fillStyle = '#ffd75e55';
    ctx.fillRect(20, 98, 120 * (s.comboTimer / (2.5 + s.player.up.combo)), 5);
  }
  // Power-up timers.
  let ty = 120;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace';
  if (s.player.spreadTimer > 0) {
    ctx.fillStyle = '#ffd75e';
    ctx.fillText(`SPREAD ${Math.ceil(s.player.spreadTimer)}s`, 20, ty);
    ty += 18;
  }
  if (s.player.rapidTimer > 0) {
    ctx.fillStyle = '#ff9de2';
    ctx.fillText(`RAPID ${Math.ceil(s.player.rapidTimer)}s`, 20, ty);
    ty += 18;
  }
  // Drafted upgrades, as a chip row.
  const chips = upgradeChips(s);
  if (chips.length > 0) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px monospace';
    let cx = 20;
    for (const chip of chips) {
      ctx.fillStyle = chip.color;
      ctx.fillText(`${chip.glyph}x${chip.count}`, cx, ty);
      cx += 46;
    }
    ty += 20;
  }
  // Dash + bomb, bottom-left where the sky is empty.
  const dashFrac = 1 - Math.max(0, s.player.dashCooldown) / DASH.cooldown;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = dashFrac >= 1 ? '#3dffc8' : COLORS.dim;
  ctx.fillText(dashFrac >= 1 ? 'DASH READY [SHIFT]' : 'DASH …', 20, 672);
  ctx.fillStyle = '#1d7a64';
  ctx.fillRect(172, 674, 100, 8);
  ctx.fillStyle = '#3dffc8';
  ctx.fillRect(172, 674, 100 * dashFrac, 8);
  ctx.fillStyle = '#ff2e63';
  ctx.fillText(`BOMB ${'◆'.repeat(s.bombs)}${'◇'.repeat(Math.max(0, s.bombsMax - s.bombs))}  [B]`, 20, 694);
  // Boss HP bar.
  if (s.boss) {
    const bw = 520;
    const bx = (VIEW.width - bw) / 2;
    const by = 52;
    const frac = Math.max(0, s.boss.hp / s.boss.maxHp);
    ctx.fillStyle = '#00000088';
    rr(ctx, bx - 8, by - 8, bw + 16, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#3a0212';
    ctx.fillRect(bx, by, bw, 14);
    ctx.fillStyle = s.boss.phase === 1 ? '#ff004c' : '#ff2e63';
    ctx.fillRect(bx, by, bw * frac, 14);
    ctx.strokeStyle = '#ff2e63';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.boss.phase === 1 ? 'VOID MAW — PHASE 2' : 'VOID MAW', VIEW.width / 2, by + 18);
  }
  ctx.restore();
}

function drawBanner(ctx, world) {
  const s = world.state;
  if (!s.banner) return;
  const a = Math.min(1, s.banner.t * 2);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = s.banner.color;
  ctx.font = 'bold 54px monospace';
  ctx.fillText(s.banner.text, VIEW.width / 2, VIEW.height / 2 - 60);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(s.banner.sub, VIEW.width / 2, VIEW.height / 2 - 18);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = '#05010fee';
  rr(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3dffc866';
  ctx.stroke();
}

function drawTitle(ctx, world, best) {
  const cx = VIEW.width / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Big neon title.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#3dffc8';
  ctx.font = 'bold 92px monospace';
  ctx.fillText('VOIDSTRIKE', cx, 168);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#eafff8';
  ctx.font = 'bold 88px monospace';
  ctx.fillText('VOIDSTRIKE', cx, 168);
  ctx.fillStyle = '#ff9de2';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('— NEON SECTOR DEFENSE —', cx, 224);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px monospace';
  ctx.fillText('Hostile swarms are pouring through the rift.', cx, 288);
  ctx.fillText('Hold the line. Chain kills. Break the Void Maw.', cx, 314);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('NEW: upgrade drafts · dash · bombs · elites · a two-phase boss', cx, 344);
  panel(ctx, cx - 330, 360, 660, 200);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('HOW TO PLAY', cx, 386);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  const lines = [
    'WASD / ARROWS — fly      MOUSE — aim      CLICK / SPACE — fire',
    'SHIFT / R-CLICK — dash     B — bomb     P — pause     R — restart',
    'After every wave: pick 1 of 3 UPGRADES — damage, multishot, pierce…',
    'Chain kills for a combo up to x8. Grab S / W / R / B drops.',
    'Clear the WAVE 10 boss to win the sector — then keep going.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, cx, 414 + i * 24));
  if (best > 0) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`BEST SCORE  ${best}`, cx, 580);
  }
  ctx.fillStyle = Math.sin(world.time * 4) > 0 ? '#3dffc8' : '#1d7a64';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('PRESS ENTER OR CLICK TO LAUNCH', cx, 626);
  ctx.restore();
}

function drawUpgrade(ctx, world) {
  const s = world.state;
  const draft = s.upgradeDraft;
  const cx = VIEW.width / 2;
  ctx.save();
  ctx.fillStyle = '#05010faa';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 44px monospace';
  ctx.fillText(`WAVE ${s.wave} CLEARED`, cx, 108);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('CHOOSE AN UPGRADE — press 1 / 2 / 3 or click a card', cx, 158);
  const rects = draftCardRects();
  draft.options.forEach((opt, i) => {
    const r = rects[i];
    panel(ctx, r.x, r.y, r.w, r.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = opt.color;
    rr(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.stroke();
    ctx.fillStyle = opt.color;
    ctx.fillRect(r.x, r.y, r.w, 6);
    ctx.fillStyle = opt.color;
    ctx.font = 'bold 64px monospace';
    ctx.fillText(opt.glyph, cx + (r.x + r.w / 2 - cx), r.y + 78);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(opt.name, r.x + r.w / 2, r.y + 158);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '17px monospace';
    // Wrap the description over two lines if it is long.
    const words = opt.desc.split(' ');
    let line = '';
    const lines = [];
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 22) {
        lines.push(line.trim());
        line = w;
      } else line += ' ' + w;
    }
    lines.push(line.trim());
    lines.forEach((ln, li) => ctx.fillText(ln, r.x + r.w / 2, r.y + 198 + li * 24));
    const owned = s.player.up[opt.id] || 0;
    ctx.fillStyle = owned > 0 ? opt.color : COLORS.dim;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(owned > 0 ? `OWNED x${owned} — stacks` : 'NEW', r.x + r.w / 2, r.y + 262);
    ctx.fillStyle = COLORS.dim;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`[${i + 1}]`, r.x + r.w / 2, r.y + 22);
  });
  // The build so far, as a chip row under the cards.
  const chips = upgradeChips(s);
  ctx.fillStyle = COLORS.dim;
  ctx.font = 'bold 15px monospace';
  if (chips.length > 0) {
    const total = chips.length * 52;
    let x = cx - total / 2;
    ctx.fillText('YOUR BUILD:', cx, 548);
    for (const chip of chips) {
      ctx.fillStyle = chip.color;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${chip.glyph}x${chip.count}`, x, 578);
      x += 52;
    }
  } else {
    ctx.fillText('Your first pick starts the build.', cx, 548);
  }
  ctx.restore();
}

function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = '#05010faa';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 52px monospace';
  ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 30);
  ctx.font = '18px monospace';
  ctx.fillText('P — resume      R — restart', VIEW.width / 2, VIEW.height / 2 + 22);
  ctx.restore();
}

function drawEnd(ctx, world, victory) {
  const s = world.state;
  const cx = VIEW.width / 2;
  ctx.save();
  ctx.fillStyle = '#05010fb8';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, cx - 340, 140, 680, 440);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = victory ? '#3dffc8' : '#ff2e63';
  ctx.font = 'bold 54px monospace';
  ctx.fillText(victory ? 'SECTOR CLEARED!' : 'GAME OVER', cx, 200);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px monospace';
  ctx.fillText(victory ? 'The Void Maw is dust. The sector is yours, pilot.' : 'Your fighter went down in the void.', cx, 256);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(`SCORE  ${s.score}`, cx, 316);
  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText(`WAVE REACHED  ${s.wave}      KILLS  ${s.kills}`, cx, 356);
  const acc = s.shotsFired > 0 ? Math.round((s.hits / s.shotsFired) * 100) : 0;
  ctx.fillText(`ACCURACY  ${acc}%      BEST  ${Math.max(s.best, s.score)}`, cx, 384);
  // The drafted build, so the victory shot shows the run's story.
  const chips = upgradeChips(s);
  ctx.fillStyle = COLORS.dim;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('UPGRADES', cx, 420);
  if (chips.length > 0) {
    const total = chips.length * 52;
    let x = cx - total / 2;
    ctx.font = 'bold 18px monospace';
    for (const chip of chips) {
      ctx.fillStyle = chip.color;
      ctx.fillText(`${chip.glyph}x${chip.count}`, x, 448);
      x += 52;
    }
  } else {
    ctx.fillText('— none drafted —', cx, 448);
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText(`DASHES  ${s.dashes}      BOMBS USED  ${s.bombsUsed}`, cx, 484);
  ctx.fillStyle = Math.sin(world.time * 4) > 0 ? '#3dffc8' : '#1d7a64';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(victory ? 'ENTER — FLY ENDLESS MODE      R — RESTART' : 'R — RETRY      ENTER — MENU', cx, 528);
  ctx.restore();
}

export function render(ctx, world, best) {
  const s = world.state;
  const time = world.time;
  ctx.save();
  // Screen shake.
  if (s.shake > 0) {
    const m = s.shake;
    ctx.translate((world.rng() * 2 - 1) * m, (world.rng() * 2 - 1) * m);
  }
  drawBackground(ctx, world, time);

  // Boss entrance telegraph: a flashing marker where the Maw will arrive.
  if (s.bossWarning > 0 && s.boss) {
    const blink = Math.floor(time * 8) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.9 : 0.25;
    ctx.strokeStyle = '#ff2e63';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(s.boss.x, 0);
    ctx.lineTo(s.boss.x, Math.max(30, s.boss.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff2e63';
    ctx.beginPath();
    ctx.moveTo(s.boss.x - 18, 26);
    ctx.lineTo(s.boss.x + 18, 26);
    ctx.lineTo(s.boss.x, 52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Power-ups.
  for (const pu of s.powerups) drawPowerup(ctx, pu, time);

  // Enemies.
  for (const e of s.enemies) drawEnemy(ctx, e, time);

  // Player bullets (a wide faint pass for glow, then the bright core).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const shot of s.shots) {
    ctx.strokeStyle = COLORS.bullet;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(shot.x - shot.vx * 0.016, shot.y - shot.vy * 0.016);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shot.x - shot.vx * 0.016, shot.y - shot.vy * 0.016);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();
    ctx.fillStyle = '#eaffb0';
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 2.5, 0, TAU);
    ctx.fill();
  }
  // Enemy bullets.
  for (const b of s.bullets) {
    ctx.fillStyle = COLORS.enemyBullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 2, 0, TAU);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Player.
  const p = s.player;
  if (p.alive && s.screen !== SCREEN_TITLE) {
    const blink = p.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#3dffc822';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, TAU);
      ctx.fill();
      ctx.restore();
      drawShip(ctx, p.x, p.y, p.angle, 1, COLORS.player, COLORS.playerCore);
      if (p.shield > 0) {
        ctx.save();
        ctx.strokeStyle = '#4dd7ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      if (p.dashTime > 0) {
        ctx.save();
        ctx.strokeStyle = '#3dffc8';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 32, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Particles (additive). Dash afterimages draw as fading ship silhouettes.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of s.particles) {
    if (pt.ghost) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife) * 0.45;
      drawShip(ctx, pt.x, pt.y, pt.angle, 1, pt.color, pt.color);
      continue;
    }
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Floating score text.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.min(1, (f.life / f.maxLife) * 1.4);
    ctx.fillStyle = f.color;
    ctx.font = `bold ${f.size}px monospace`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();

  if (s.screen !== SCREEN_TITLE) drawHud(ctx, world);
  drawBanner(ctx, world);

  // Damage flash.
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255, 46, 99, ${s.flash * 0.35})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  ctx.restore();

  // Screens on top (no shake).
  if (s.screen === SCREEN_TITLE) drawTitle(ctx, world, best);
  else if (s.screen === SCREEN_PAUSE) drawPause(ctx);
  else if (s.screen === SCREEN_OVER) drawEnd(ctx, world, false);
  else if (s.screen === SCREEN_VICTORY) drawEnd(ctx, world, true);
  else if (s.screen === SCREEN_UPGRADE) drawUpgrade(ctx, world);
}
