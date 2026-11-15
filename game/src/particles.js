// Lumen Drift — particles, shockwaves and floating score text.
// One clear job: every purely cosmetic burst the game spawns, kept in one
// place so gameplay files never draw their own effects.

export class Particles {
  constructor() {
    this.list = [];
    this.rings = [];
    this.texts = [];
  }

  // A radial burst of glowing sparks.
  burst(x, y, color, count = 18, speed = 260, life = 0.6, size = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        drag: 2.2,
      });
    }
  }

  // A small engine trail puff behind the ship.
  trail(x, y, color) {
    this.list.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      life: 0.35,
      maxLife: 0.35,
      size: 2.5,
      color,
      drag: 1,
    });
  }

  ring(x, y, color, maxRadius = 90) {
    this.rings.push({ x, y, radius: 6, maxRadius, life: 0.45, maxLife: 0.45, color });
  }

  floatText(x, y, text, color = '#ffffff', size = 15) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.radius = r.maxRadius * (1 - r.life / r.maxLife);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.rings) {
      const alpha = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${t.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  clear() {
    this.list = [];
    this.rings = [];
    this.texts = [];
  }
}
