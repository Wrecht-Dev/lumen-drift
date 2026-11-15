// Lumen Drift — pickups: score gems, hull repair, shield and overdrive.
// One clear job: the good things that drop, how they drift, and what they
// do when the player collects them.

import { PICKUPS } from './config.js';

export class Pickups {
  constructor() {
    this.list = [];
  }

  spawnGem(x, y, rng) {
    this.list.push({
      kind: 'gem',
      x: x + rng.range(-14, 14),
      y: y + rng.range(-14, 14),
      vx: rng.range(-40, 40),
      vy: rng.range(-40, 40),
      radius: 8,
      life: PICKUPS.despawnSeconds,
      phase: rng.range(0, Math.PI * 2),
    });
  }

  spawnPower(x, y, kind, rng) {
    this.list.push({
      kind,
      x,
      y,
      vx: rng.range(-30, 30),
      vy: rng.range(-30, 30),
      radius: 13,
      life: PICKUPS.despawnSeconds,
      phase: rng.range(0, Math.PI * 2),
    });
  }

  // Roll the per-kill drop table after an enemy dies.
  rollDrop(x, y, rng) {
    const roll = rng.next();
    if (roll < PICKUPS.hullChance) this.spawnPower(x, y, 'hull', rng);
    else if (roll < PICKUPS.hullChance + PICKUPS.shieldChance) this.spawnPower(x, y, 'shield', rng);
    else if (roll < PICKUPS.hullChance + PICKUPS.shieldChance + PICKUPS.overdriveChance) {
      this.spawnPower(x, y, 'overdrive', rng);
    }
  }

  update(dt, player) {
    for (const p of this.list) {
      p.life -= dt;
      p.phase += dt * 3;
      if (p.kind === 'gem' && player.alive) {
        // Gems drift toward the player when close (magnet radius).
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < player.magnetRadius) {
          const pull = 900 * (1 - dist / (player.magnetRadius + 1));
          p.vx += (dx / (dist || 1)) * pull * dt;
          p.vy += (dy / (dist || 1)) * pull * dt;
        }
      }
      p.vx *= Math.pow(0.4, dt);
      p.vy *= Math.pow(0.4, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  // Collect whatever touches the player. Returns the collected kinds.
  collect(player) {
    const got = [];
    this.list = this.list.filter((p) => {
      const dist = Math.hypot(p.x - player.x, p.y - player.y);
      if (player.alive && dist < p.radius + player.radius) {
        got.push(p.kind);
        return false;
      }
      return true;
    });
    return got;
  }

  clear() {
    this.list = [];
  }
}
