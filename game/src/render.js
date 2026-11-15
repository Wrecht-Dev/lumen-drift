// Lumen Drift — rendering: the starfield, the ship, the enemies, the HUD
// and every screen (title, draft, pause, game over). One clear job: draw
// the current state, and nothing else. Game logic never draws.

import { PALETTE, VIEW } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.time = 0;
  }

  initStars(rng) {
    this.stars = [];
    for (let i = 0; i < 130; i++) {
      this.stars.push({
        x: rng.range(0, VIEW.width),
        y: rng.range(0, VIEW.height),
        size: rng.range(0.6, 2.2),
        bright: rng.next() > 0.7,
        twinkle: rng.range(0, Math.PI * 2),
        drift: rng.range(4, 18),
      });
    }
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  drawBackground(dt) {
    const ctx = this.ctx;
    this.time += dt;
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, PALETTE.backgroundTop);
    grad.addColorStop(1, PALETTE.backgroundBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // Slow parallax starfield.
    for (const s of this.stars) {
      s.y += s.drift * dt;
      if (s.y > VIEW.height + 2) {
        s.y = -2;
        s.x = Math.random() * VIEW.width;
      }
      const tw = 0.55 + 0.45 * Math.sin(this.time * 1.5 + s.twinkle);
      ctx.globalAlpha = tw * (s.bright ? 0.9 : 0.5);
      ctx.fillStyle = s.bright ? PALETTE.starBright : PALETTE.starDim;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Faint drifting grid, for a sense of motion.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    const step = 64;
    const off = (this.time * 12) % step;
    ctx.beginPath();
    for (let x = -step + off; x < VIEW.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW.height);
    }
    for (let y = -step + off; y < VIEW.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
    }
    ctx.stroke();
  }

  beginFrame(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
    this.drawBackground(dt);
    this.ctx.save();
    this.ctx.translate(this.shakeX, this.shakeY);
  }

  endFrame() {
    this.ctx.restore();
  }

  drawPickups(pickups) {
    const ctx = this.ctx;
    ctx.save();
    for (const p of pickups.list) {
      const blink = p.life < 3 ? (Math.sin(p.life * 10) > 0 ? 1 : 0.35) : 1;
      ctx.globalAlpha = blink;
      const bob = Math.sin(p.phase) * 2;
      if (p.kind === 'gem') {
        ctx.fillStyle = PALETTE.gem;
        ctx.shadowColor = PALETTE.gem;
        ctx.shadowBlur = 10;
        polygon(ctx, p.x, p.y + bob, 8, 4, p.phase * 0.5);
        ctx.fill();
      } else if (p.kind === 'hull') {
        ctx.fillStyle = PALETTE.hull;
        ctx.shadowColor = PALETTE.hull;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', p.x, p.y + bob + 0.5);
      } else if (p.kind === 'shield') {
        ctx.strokeStyle = PALETTE.shield;
        ctx.shadowColor = PALETTE.shield;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, p.radius - 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = PALETTE.shield;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'overdrive') {
        ctx.fillStyle = PALETTE.overdrive;
        ctx.shadowColor = PALETTE.overdrive;
        ctx.shadowBlur = 12;
        polygon(ctx, p.x, p.y + bob, 11, 3, -Math.PI / 2 + Math.sin(p.phase) * 0.2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawBullets(bullets) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      if (b.friendly) {
        ctx.strokeStyle = PALETTE.bullet;
        ctx.shadowColor = PALETTE.bulletGlow;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = '#fff7cc';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.enemyBullet;
        ctx.shadowColor = PALETTE.enemyBullet;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd7de';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawPlayer(player) {
    if (!player.alive) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(player.x, player.y);
    // Invulnerability blink.
    if (player.invuln > 0 && Math.floor(this.time * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    // Shield ring.
    if (player.shielded) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 10 + Math.sin(this.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.rotate(player.angle);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-13, -12);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawEnemies(enemies) {
    const ctx = this.ctx;
    for (const e of enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.shadowColor = e.spec.color;
      ctx.shadowBlur = 14;
      const flash = e.flash > 0;
      ctx.fillStyle = flash ? '#ffffff' : e.spec.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.5;
      if (e.type === 'warden') {
        // Boss: double ring, rotating outer teeth.
        polygon(ctx, 0, 0, e.radius, e.spec.sides, e.angle * 0.4);
        ctx.fill();
        ctx.stroke();
        polygon(ctx, 0, 0, e.radius * 0.62, e.spec.sides, -e.angle * 0.7);
        ctx.fillStyle = 'rgba(10, 8, 24, 0.85)';
        ctx.fill();
        ctx.fillStyle = flash ? '#ffffff' : '#ffd7d7';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else {
        polygon(ctx, 0, 0, e.radius, e.spec.sides, e.angle);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(7, 10, 26, 0.8)';
        polygon(ctx, 0, 0, e.radius * 0.45, e.spec.sides, -e.angle);
        ctx.fill();
      }
      ctx.restore();
      // Boss health bar above the boss.
      if (e.type === 'warden') {
        const w = 150;
        const frac = Math.max(0, e.hp / e.maxHp);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, e.x - w / 2, e.y - e.radius - 26, w, 9, 4);
        ctx.fill();
        ctx.fillStyle = PALETTE.enemyBoss;
        roundRect(ctx, e.x - w / 2 + 1.5, e.y - e.radius - 24.5, (w - 3) * frac, 6, 3);
        ctx.fill();
        ctx.restore();
      } else if (e.maxHp > 2) {
        const w = 34;
        const frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
        ctx.fillStyle = e.spec.color;
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * frac, 4);
      }
    }
  }

  drawParticles(particles) {
    particles.draw(this.ctx);
  }

  drawHud(state) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('SCORE', 24, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(state.score).padStart(6, '0'), 24, 62);
    // Combo, under the score.
    if (state.comboCount > 1) {
      ctx.fillStyle = PALETTE.accent;
      ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`COMBO x${state.comboMult}  (${state.comboCount})`, 24, 90);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.5)';
      ctx.fillRect(24, 98, 120 * state.comboFrac, 4);
    }
    // Wave, top center.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('WAVE', VIEW.width / 2, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(state.wave), VIEW.width / 2, 62);
    if (state.waveState === 'incoming') {
      ctx.fillStyle = PALETTE.accent;
      ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('INCOMING…', VIEW.width / 2, 90);
    }
    // Hull hearts, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('HULL', VIEW.width - 24, 30);
    for (let i = 0; i < state.hullMax; i++) {
      const x = VIEW.width - 32 - i * 30;
      const y = 52;
      ctx.fillStyle = i < state.hull ? PALETTE.hull : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.bezierCurveTo(x - 11, y - 3, x - 6, y - 11, x, y - 4);
      ctx.bezierCurveTo(x + 6, y - 11, x + 11, y - 3, x, y + 7);
      ctx.fill();
    }
    // Active timers (shield / overdrive), under the hearts.
    let line = 92;
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    if (state.shield > 0) {
      ctx.fillStyle = PALETTE.shield;
      ctx.fillText(`SHIELD ${state.shield.toFixed(0)}s`, VIEW.width - 24, line);
      line += 20;
    }
    if (state.overdrive > 0) {
      ctx.fillStyle = PALETTE.overdrive;
      ctx.fillText(`OVERDRIVE ${state.overdrive.toFixed(0)}s`, VIEW.width - 24, line);
    }
    // Best score, bottom left.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(157, 180, 216, 0.75)';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`BEST ${state.best}`, 24, VIEW.height - 20);
    ctx.textAlign = 'right';
    ctx.fillText('M mute · P pause', VIEW.width - 24, VIEW.height - 20);
    ctx.restore();
  }

  drawCenterPanel(title, lines, accent = PALETTE.accent) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 54px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    ctx.fillText(title, VIEW.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.font = '400 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    let y = 296;
    for (const line of lines) {
      ctx.fillText(line, VIEW.width / 2, y);
      y += 30;
    }
    ctx.restore();
  }

  drawTitle(best) {
    const ctx = this.ctx;
    ctx.save();
    // Big glowing title.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 84px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 34;
    ctx.fillText('LUMEN DRIFT', VIEW.width / 2, 240);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.accent;
    ctx.font = '600 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('a neon arena survival game', VIEW.width / 2, 282);
    // How to play panel.
    const pw = 560;
    const ph = 210;
    const px = VIEW.width / 2 - pw / 2;
    const py = 330;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, px, py, pw, ph, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 14);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
    const rows = [
      ['WASD / arrows', 'fly your ship'],
      ['Mouse', 'aim — hold click or Space to fire'],
      ['1 · 2 · 3', 'pick an upgrade between waves'],
      ['Survive', 'waves of drifters, darters, weavers — and the Warden every 5th wave'],
    ];
    let y = py + 40;
    for (const [key, desc] of rows) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.accent;
      ctx.fillText(key, VIEW.width / 2 - 8, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(desc, VIEW.width / 2 + 8, y);
      y += 34;
    }
    // Start prompt, pulsing.
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER or click to launch', VIEW.width / 2, 600);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`Best score: ${best}`, VIEW.width / 2, 640);
    }
    ctx.restore();
  }

  drawDraft(draft, wave) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 44px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = PALETTE.accent;
    ctx.shadowBlur = 18;
    ctx.fillText(`WAVE ${wave} CLEARED`, VIEW.width / 2, 180);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '400 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Choose one upgrade — press 1, 2 or 3, or click a card', VIEW.width / 2, 222);
    const cw = 300;
    const ch = 190;
    const gap = 28;
    const total = cw * 3 + gap * 2;
    const startX = VIEW.width / 2 - total / 2;
    const y = 290;
    draft.forEach((up, i) => {
      const x = startX + i * (cw + gap);
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelBorder;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.stroke();
      ctx.fillStyle = PALETTE.accent;
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`[${i + 1}]`, x + cw / 2, y + 34);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '700 23px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(up.name, x + cw / 2, y + 78);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '400 17px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(up.desc, x + cw / 2, y + 116);
      // Card icon: a small glowing glyph per upgrade id.
      ctx.fillStyle = PALETTE.player;
      ctx.shadowColor = PALETTE.player;
      ctx.shadowBlur = 10;
      polygon(ctx, x + cw / 2, y + 152, 12, up.id === 'twin' ? 2 : 5, this.time * 0.5);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  drawGameOver(score, wave, best, isNewBest) {
    this.drawCenterPanel('SHIP LOST', [
      `You fell on wave ${wave} with ${score.toLocaleString()} points.`,
      isNewBest ? 'A new best score!' : `Best score: ${best.toLocaleString()}`,
      '',
      'Press ENTER or click to fly again',
    ], PALETTE.danger);
  }

  drawPaused() {
    this.drawCenterPanel('PAUSED', [
      'Take a breath, pilot.',
      '',
      'Press P or click to resume',
    ]);
  }

  drawWaveBanner(text) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, 1.2 - Math.abs(0.6 - this.bannerT) * 1.4);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 46px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = PALETTE.accent;
    ctx.shadowBlur = 22;
    ctx.fillText(text, VIEW.width / 2, 330);
    ctx.restore();
  }
}
