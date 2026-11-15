// Lumen Drift — the player ship: movement, aiming, firing, damage and
// the upgradeable stats the draft screen spends. One clear job: the ship.

import { PLAYER, PICKUPS } from './config.js';

export class Player {
  constructor(x, y) {
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2; // nose up
    this.radius = PLAYER.radius;
    this.alive = true;
    this.hull = PLAYER.hullMax;
    this.hullMax = PLAYER.hullMax;
    this.invuln = 0;
    this.fireTimer = 0;
    this.respawnTimer = 0;
    this.shield = 0;
    this.overdrive = 0;
    // Upgradeable stats; the draft screen mutates these.
    this.fireInterval = PLAYER.fireInterval;
    this.bulletDamage = PLAYER.bulletDamage;
    this.bulletSpeed = PLAYER.bulletSpeed;
    this.bulletLife = PLAYER.bulletLife;
    this.maxSpeed = PLAYER.maxSpeed;
    this.projectiles = 1;
    this.pierce = 0;
    this.magnetRadius = PICKUPS.gemMagnetRadius;
    this.trailTimer = 0;
  }

  get fireIntervalNow() {
    return this.overdrive > 0 ? PICKUPS.overdriveFireInterval : this.fireInterval;
  }

  get shielded() {
    return this.shield > 0;
  }

  update(dt, input, bounds, sound, particles) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.overdrive = Math.max(0, this.overdrive - dt);

    const move = input.moveVector();
    this.vx += move.x * PLAYER.accel * dt;
    this.vy += move.y * PLAYER.accel * dt;
    const drag = Math.pow(PLAYER.drag, dt * 60);
    this.vx *= drag;
    this.vy *= drag;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const m = this.radius + 4;
    this.x = Math.max(m, Math.min(bounds.width - m, this.x));
    this.y = Math.max(m, Math.min(bounds.height - m, this.y));

    // Aim at the mouse; the ship's nose follows it.
    const dx = input.mouseX - this.x;
    const dy = input.mouseY - this.y;
    if (dx * dx + dy * dy > 4) this.angle = Math.atan2(dy, dx);

    // Engine trail while moving.
    this.trailTimer -= dt;
    if (speed > 60 && this.trailTimer <= 0) {
      this.trailTimer = 0.03;
      const bx = this.x - Math.cos(this.angle) * (this.radius + 2);
      const by = this.y - Math.sin(this.angle) * (this.radius + 2);
      particles.trail(bx, by, this.overdrive > 0 ? '#ffd166' : '#7df9ff');
    }

    this.fireTimer -= dt;
    if (input.firing && this.fireTimer <= 0) {
      this.fireTimer = this.fireIntervalNow;
      return this.fire();
    }
    return null;
  }

  // Build the bullets for one shot. Returns an array of bullet specs.
  fire() {
    const bullets = [];
    const spread = 0.14; // radians between projectiles
    const n = this.projectiles;
    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * spread;
      const a = this.angle + offset;
      bullets.push({
        x: this.x + Math.cos(a) * (this.radius + 8),
        y: this.y + Math.sin(a) * (this.radius + 8),
        vx: Math.cos(a) * this.bulletSpeed,
        vy: Math.sin(a) * this.bulletSpeed,
        radius: PLAYER.bulletRadius,
        damage: this.bulletDamage,
        pierce: this.pierce,
        life: this.bulletLife,
        friendly: true,
      });
    }
    return bullets;
  }

  // Returns 'dead' | 'shield' | 'hit'. The caller plays the sound.
  takeHit() {
    if (!this.alive || this.invuln > 0) return 'none';
    if (this.shield > 0) {
      this.shield = 0;
      this.invuln = 1.0;
      return 'shield';
    }
    this.hull -= 1;
    this.invuln = PLAYER.invulnSeconds;
    if (this.hull <= 0) {
      this.alive = false;
      this.respawnTimer = PLAYER.respawnDelay;
      return 'dead';
    }
    return 'hit';
  }

  heal(amount) {
    this.hull = Math.min(this.hullMax, this.hull + amount);
  }
}
