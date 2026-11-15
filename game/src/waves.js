// Lumen Drift — the wave director and the between-wave upgrade draft.
// One clear job: decide what spawns, when a wave is won, and which three
// upgrades the player chooses from between waves.

import { WAVES, WAVE_MIX, UPGRADES } from './config.js';
import { Enemy, spawnPoint } from './enemies.js';

export class Waves {
  constructor(rng) {
    this.rng = rng;
    this.wave = 0;
    this.queue = []; // enemy types still to spawn this wave
    this.spawnTimer = 0;
    this.betweenTimer = 0;
    this.draft = null; // three upgrade options, or null
    this.bossSpawned = false;
  }

  get spawnInterval() {
    const v = WAVES.spawnIntervalStart - (this.wave - 1) * WAVES.spawnIntervalFalloff;
    return Math.max(WAVES.spawnIntervalMin, v);
  }

  get active() {
    return this.queue.length > 0 || this.bossSpawned;
  }

  startWave(n) {
    this.wave = n;
    this.queue = [];
    const count = WAVES.baseCount + (n - 1) * WAVES.perWave;
    const mix = WAVE_MIX.filter((m) => n >= m.fromWave).map((m) => ({ value: m.type, weight: m.weight }));
    for (let i = 0; i < count; i++) this.queue.push(this.rng.weighted(mix));
    this.bossSpawned = false;
    if (n % WAVES.bossEvery === 0) {
      this.queue.push('warden');
      this.bossSpawned = true;
    }
    // Shuffle so the boss is not always last.
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.spawnTimer = 0.6;
    this.draft = null;
  }

  // Spawn due enemies. Returns the new Enemy objects.
  update(dt, player, enemies) {
    if (this.draft) return [];
    if (this.queue.length === 0) return [];
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return [];
    this.spawnTimer = this.spawnInterval;
    const type = this.queue.shift();
    const at = spawnPoint(this.rng, player);
    const enemy = new Enemy(type, at.x, at.y, this.rng);
    enemies.push(enemy);
    return [enemy];
  }

  // True when the field is empty and nothing is left to spawn.
  isCleared(enemies) {
    return this.queue.length === 0 && enemies.length === 0 && !this.draft;
  }

  // Roll three distinct upgrades for the draft screen.
  rollDraft() {
    const pool = [...UPGRADES];
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const i = this.rng.int(0, pool.length - 1);
      picks.push(pool.splice(i, 1)[0]);
    }
    this.draft = picks;
    return picks;
  }

  applyDraft(index, player) {
    const choice = this.draft && this.draft[index];
    if (!choice) return null;
    choice.apply(player);
    this.draft = null;
    return choice;
  }
}
