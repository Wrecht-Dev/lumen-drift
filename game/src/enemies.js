// Lumen Drift — enemies: the five kinds, their movement brains, and the
// bullets the shooters fire. One clear job: everything hostile that moves.

import { ENEMIES, VIEW } from './config.js';

export class Enemy {
  constructor(type, x, y, rng) {
    const spec = ENEMIES[type];
    this.type = type;
    this.spec = spec;
    this.x = x;
    this.y = y;
    this.radius = spec.radius;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.speed = spec.speed * rng.range(0.9, 1.1);
    this.angle = rng.angle();
    this.spin = rng.range(-1.2, 1.2);
    this.score = spec.score;
    this.flash = 0; // hit-flash timer
    // Lunge state (darter).
    this.lungeTimer = rng.range(0.5, 1.5);
    this.lunging = 0;
    this.lungeAngle = 0;
    // Shooting state (weaver, warden).
    this.shootTimer = rng.range(1, spec.shootCooldown ?? 2);
    this.wobble = rng.range(0, Math.PI * 2);
    this.dead = false;
  }

  // Returns enemy bullets fired this frame (possibly none).
  update(dt, player, rng) {
    this.flash = Math.max(0, this.flash - dt);
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    this.angle += this.spin * dt;
    const fired = [];

    switch (this.spec.behavior) {
      case 'chase': {
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        break;
      }
      case 'lunge': {
        if (this.lunging > 0) {
          this.lunging -= dt;
          this.x += Math.cos(this.lungeAngle) * this.spec.lungeSpeed * dt;
          this.y += Math.sin(this.lungeAngle) * this.spec.lungeSpeed * dt;
        } else {
          this.lungeTimer -= dt;
          // Drift slowly toward the player while winding up.
          this.x += nx * this.speed * 0.4 * dt;
          this.y += ny * this.speed * 0.4 * dt;
          if (this.lungeTimer <= 0 && dist < 520) {
            this.lunging = this.spec.lungeTime;
            this.lungeAngle = Math.atan2(dy, dx);
            this.lungeTimer = this.spec.lungeCooldown;
          }
        }
        break;
      }
      case 'shoot': {
        // Orbit at a distance, firing slow orbs.
        this.wobble += dt;
        const want = this.spec.keepDistance;
        const radial = dist < want - 40 ? -1 : dist > want + 40 ? 1 : 0;
        const tangent = Math.sin(this.wobble * 0.7) > 0 ? 1 : -1;
        this.x += (nx * radial + -ny * tangent * 0.6) * this.speed * dt;
        this.y += (ny * radial + nx * tangent * 0.6) * this.speed * dt;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && dist < 640 && player.alive) {
          this.shootTimer = this.spec.shootCooldown * rng.range(0.85, 1.2);
          fired.push({
            x: this.x,
            y: this.y,
            vx: nx * this.spec.bulletSpeed,
            vy: ny * this.spec.bulletSpeed,
            radius: 6,
            damage: 1,
            life: 4,
            friendly: false,
          });
        }
        break;
      }
      case 'boss': {
        // Slow approach, then hold near the top-center and fire rings.
        const anchorY = 170;
        const tx = VIEW.width / 2 + Math.sin(this.wobble * 0.5) * 260;
        const ty = anchorY + Math.sin(this.wobble * 0.8) * 60;
        this.wobble += dt;
        this.x += (tx - this.x) * 0.6 * dt;
        this.y += (ty - this.y) * 0.6 * dt;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && player.alive) {
          this.shootTimer = this.spec.shootCooldown;
          const count = this.spec.burstCount;
          const base = Math.atan2(dy, dx);
          for (let i = 0; i < count; i++) {
            const a = base + (i / count) * Math.PI * 2;
            fired.push({
              x: this.x + Math.cos(a) * (this.radius + 6),
              y: this.y + Math.sin(a) * (this.radius + 6),
              vx: Math.cos(a) * this.spec.bulletSpeed,
              vy: Math.sin(a) * this.spec.bulletSpeed,
              radius: 6,
              damage: 1,
              life: 5,
              friendly: false,
            });
          }
        }
        break;
      }
      default: {
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
      }
    }

    // Stay inside the arena: clamp at the edges. Enemies used to wrap
    // to the opposite side, which read as a teleport — a chaser could
    // vanish off the left edge and pop in on the right behind the
    // player. Clamped chasers steer back in toward the player on their
    // own; the margin lets spawns just outside the view drift in.
    const m = this.radius + 8;
    this.x = Math.max(-m, Math.min(VIEW.width + m, this.x));
    this.y = Math.max(-m, Math.min(VIEW.height + m, this.y));
    return fired;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flash = 0.12;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }
}

// Pick a spawn point just outside the view, away from the player.
export function spawnPoint(rng, player) {
  for (let tries = 0; tries < 12; tries++) {
    const edge = rng.int(0, 3);
    let x;
    let y;
    if (edge === 0) { x = rng.range(0, VIEW.width); y = -30; }
    else if (edge === 1) { x = VIEW.width + 30; y = rng.range(0, VIEW.height); }
    else if (edge === 2) { x = rng.range(0, VIEW.width); y = VIEW.height + 30; }
    else { x = -30; y = rng.range(0, VIEW.height); }
    if (Math.hypot(x - player.x, y - player.y) > 260) return { x, y };
  }
  return { x: VIEW.width / 2, y: -30 };
}
