// VOIDSTRIKE — every pixel the player sees. It draws only what world.js holds:
// the starfield, the ships, the bullets, the HUD and the menu screens. No game
// logic lives here; change a look without touching a rule.
import { VIEW, PLAYER, POWERUP, ENEMY, COLORS } from './config.js';
import { SCREEN_TITLE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_VICTORY } from './world.js';

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
  ctx.lineWidth = 2;
  ctx.strokeStyle = core;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -2, 4, 0, TAU);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
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
  } else if (e.kind === 'boss') {
    const wob = Math.sin(time * 2) * 0.05;
    ctx.rotate(wob);
    // Outer ring.
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, TAU);
    ctx.fillStyle = '#2a0218';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = e.color;
    ctx.stroke();
    // Spikes.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + time * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.85, Math.sin(a) * e.radius * 0.85);
      ctx.lineTo(Math.cos(a) * (e.radius + 16), Math.sin(a) * (e.radius + 16));
      ctx.lineTo(Math.cos(a + 0.2) * e.radius * 0.85, Math.sin(a + 0.2) * e.radius * 0.85);
      ctx.closePath();
      ctx.fillStyle = e.color;
      ctx.fill();
    }
    // Core eye.
    const eyeR = 16 + Math.sin(time * 5) * 3;
    ctx.beginPath();
    ctx.arc(0, 0, eyeR, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, eyeR * 0.55, 0, TAU);
    ctx.fillStyle = '#ff2e63';
    ctx.fill();
    // HP ring.
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 4;
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
  ctx.fillStyle = 'rgba(255, 215, 94, 0.12)';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.arc(0, 0, POWERUP.radius, 0, TAU);
  ctx.fillStyle = '#0d0221';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffd75e';
  ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyph = { shield: 'S', spread: 'W', rapid: 'R', life: '+' }[pu.kind];
  ctx.fillText(glyph, 0, 1);
  ctx.restore();
}

function drawBackground(ctx, world, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, COLORS.bg0);
  grad.addColorStop(1, COLORS.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  for (const neb of world.nebulae) {
    const g = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
    g.addColorStop(0, neb.color + '30');
    g.addColorStop(1, neb.color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(neb.x - neb.r, neb.y - neb.r, neb.r * 2, neb.r * 2);
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
    ctx.fillRect(20, 98, 120 * (s.comboTimer / 2.5), 5);
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
    ctx.fillStyle = '#ff2e63';
    ctx.fillRect(bx, by, bw * frac, 14);
    ctx.strokeStyle = '#ff2e63';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VOID MAW', VIEW.width / 2, by + 18);
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
  ctx.fillText('Hostile swarms are pouring through the rift.', cx, 292);
  ctx.fillText('Hold the line. Chain kills. Break the Void Maw.', cx, 320);
  panel(ctx, cx - 330, 360, 660, 168);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('HOW TO PLAY', cx, 386);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  const lines = [
    'WASD / ARROWS — fly      MOUSE — aim      CLICK / SPACE — fire',
    'P — pause      R — restart      M — mute',
    'Chain kills for a combo up to x8. Grab S / W / R drops.',
    'Clear the WAVE 10 boss to win the sector — then keep going.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, cx, 414 + i * 24));
  if (best > 0) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`BEST SCORE  ${best}`, cx, 566);
  }
  ctx.fillStyle = Math.sin(world.time * 4) > 0 ? '#3dffc8' : '#1d7a64';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('PRESS ENTER OR CLICK TO LAUNCH', cx, 624);
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
  panel(ctx, cx - 340, 150, 680, 380);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = victory ? '#3dffc8' : '#ff2e63';
  ctx.font = 'bold 54px monospace';
  ctx.fillText(victory ? 'SECTOR CLEARED!' : 'GAME OVER', cx, 210);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px monospace';
  ctx.fillText(victory ? 'The Void Maw is dust. The sector is yours, pilot.' : 'Your fighter went down in the void.', cx, 268);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(`SCORE  ${s.score}`, cx, 330);
  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText(`WAVE REACHED  ${s.wave}      KILLS  ${s.kills}`, cx, 372);
  const acc = s.shotsFired > 0 ? Math.round((s.hits / s.shotsFired) * 100) : 0;
  ctx.fillText(`ACCURACY  ${acc}%      BEST  ${Math.max(s.best, s.score)}`, cx, 400);
  ctx.fillStyle = Math.sin(world.time * 4) > 0 ? '#3dffc8' : '#1d7a64';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(victory ? 'ENTER — FLY ENDLESS MODE      R — RESTART' : 'R — RETRY      ENTER — MENU', cx, 470);
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

  // Power-ups.
  for (const pu of s.powerups) drawPowerup(ctx, pu, time);

  // Enemies.
  for (const e of s.enemies) drawEnemy(ctx, e, time);

  // Player bullets (additive glow).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const shot of s.shots) {
    ctx.strokeStyle = COLORS.bullet;
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
    }
  }

  // Particles (additive).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of s.particles) {
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
}
