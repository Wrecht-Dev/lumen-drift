// Lumen Drift — the game loop and state machine: title, playing, draft,
// paused, game over. One clear job: own the state, step the world, and hand
// each frame to the renderer. Nothing here draws directly.

import { VIEW, PLAYER, WAVES, PICKUPS, COMBO, STORAGE_BEST_KEY } from './config.js';
import { makeRng } from './random.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Enemy } from './enemies.js';
import { Pickups } from './pickups.js';
import { Waves } from './waves.js';
import { Particles } from './particles.js';
import { Renderer } from './render.js';
import { ShotDirector } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const shotMode = params.get('shot');
const rng = makeRng(Number.isFinite(seedParam) ? seedParam : (Date.now() % 2147483647));

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const input = new Input(canvas);
const sound = new SoundEngine();
const renderer = new Renderer(canvas);
const particles = new Particles();
const pickups = new Pickups();
const waves = new Waves(rng);
const player = new Player(VIEW.width / 2, VIEW.height - 160);
renderer.initStars(rng);

const game = {
  state: 'title', // title | playing | draft | paused | gameover | dying
  score: 0,
  best: 0,
  wave: 0,
  comboCount: 0,
  comboTimer: 0,
  comboMult: 1,
  kills: 0,
  bullets: [],
  enemies: [],
  dyingTimer: 0,
  bannerText: '',
  bannerTimer: 0,
  newBest: false,
  frames: 0,
  ready: false,
};

try {
  game.best = Number(window.localStorage.getItem(STORAGE_BEST_KEY) || 0) || 0;
} catch {
  game.best = 0;
}

function saveBest() {
  try {
    window.localStorage.setItem(STORAGE_BEST_KEY, String(game.best));
  } catch {
    // Private mode or blocked storage: best score just doesn't persist.
  }
}

function comboMultiplier() {
  return Math.min(COMBO.maxMultiplier, 1 + Math.floor(game.comboCount / 4));
}

function addScore(base, x, y) {
  const mult = comboMultiplier();
  const gained = base * mult;
  game.score += gained;
  if (x !== undefined) particles.floatText(x, y, `+${gained}`, '#ffd166', 15);
  return gained;
}

function startGame() {
  game.score = 0;
  game.comboCount = 0;
  game.comboTimer = 0;
  game.comboMult = 1;
  game.kills = 0;
  game.bullets = [];
  game.enemies = [];
  game.newBest = false;
  particles.clear();
  pickups.clear();
  player.reset(VIEW.width / 2, VIEW.height - 160);
  waves.startWave(1);
  game.wave = 1;
  game.state = 'playing';
  game.bannerText = 'WAVE 1';
  game.bannerTimer = 1.6;
  sound.startMusic();
  sound.waveStart();
  updateStatus();
}

function gameOver() {
  game.state = 'gameover';
  game.newBest = game.score > game.best;
  if (game.newBest) {
    game.best = game.score;
    saveBest();
  }
  sound.stopMusic();
  sound.gameOver();
  updateStatus();
}

function nextWave() {
  const bonus = WAVES.clearBonus * game.wave;
  game.score += bonus;
  particles.floatText(VIEW.width / 2, VIEW.height / 2 - 60, `WAVE BONUS +${bonus}`, '#5ef2b8', 20);
  sound.waveClear();
  waves.rollDraft();
  game.state = 'draft';
  updateStatus();
}

function chooseUpgrade(index) {
  const picked = waves.applyDraft(index, player);
  if (!picked) return;
  sound.upgrade();
  particles.ring(player.x, player.y, '#7df9ff', 120);
  waves.startWave(game.wave + 1);
  game.wave += 1;
  game.state = 'playing';
  game.bannerText = `WAVE ${game.wave}`;
  game.bannerTimer = 1.6;
  sound.waveStart();
  updateStatus();
}

function killEnemy(enemy, awardScore = true) {
  enemy.dead = true;
  game.kills += 1;
  game.comboCount += COMBO.perKill;
  game.comboTimer = COMBO.windowSeconds;
  game.comboMult = comboMultiplier();
  if (awardScore) addScore(enemy.score, enemy.x, enemy.y - 20);
  particles.burst(enemy.x, enemy.y, enemy.spec.color, enemy.type === 'warden' ? 60 : 22, enemy.type === 'warden' ? 420 : 280);
  particles.ring(enemy.x, enemy.y, enemy.spec.color, enemy.type === 'warden' ? 160 : 70);
  renderer.addShake(enemy.type === 'warden' ? 12 : 4);
  sound.explode(enemy.type === 'warden' || enemy.type === 'splitter');
  // Gems: one per enemy, two for the tougher kinds.
  const gems = enemy.type === 'warden' ? 8 : enemy.spec.hp >= 3 ? 2 : 1;
  for (let i = 0; i < gems; i++) pickups.spawnGem(enemy.x, enemy.y, rng);
  pickups.rollDrop(enemy.x, enemy.y, rng);
  if (enemy.type === 'splitter') {
    for (let i = 0; i < enemy.spec.children; i++) {
      const child = new Enemy('drifter', enemy.x + rng.range(-20, 20), enemy.y + rng.range(-20, 20), rng);
      game.enemies.push(child);
    }
  }
}

function hurtPlayer() {
  const result = player.takeHit();
  if (result === 'none') return;
  if (result === 'shield') {
    particles.ring(player.x, player.y, '#6ec6ff', 90);
    sound.hit();
    return;
  }
  particles.burst(player.x, player.y, '#ff6b81', 30, 340);
  renderer.addShake(10);
  sound.hurt();
  game.comboCount = 0;
  game.comboMult = 1;
  if (result === 'dead') {
    particles.burst(player.x, player.y, '#7df9ff', 70, 460, 1.0, 4);
    particles.ring(player.x, player.y, '#ffffff', 180);
    renderer.addShake(16);
    sound.explode(true);
    game.state = 'dying';
    game.dyingTimer = PLAYER.respawnDelay + 0.5;
  }
  updateStatus();
}

function updateBullets(dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  game.bullets = game.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < VIEW.width + 20 && b.y > -20 && b.y < VIEW.height + 20);
}

function collideBullets() {
  for (const b of game.bullets) {
    if (!b.friendly) continue;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const dist = Math.hypot(b.x - e.x, b.y - e.y);
      if (dist < b.radius + e.radius) {
        const died = e.takeDamage(b.damage);
        particles.burst(b.x, b.y, '#ffe066', 5, 160, 0.3, 2);
        sound.hit();
        if (died) killEnemy(e);
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          b.life = 0;
        }
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}

function collidePlayer() {
  if (!player.alive) return;
  for (const b of game.bullets) {
    if (b.friendly) continue;
    if (Math.hypot(b.x - player.x, b.y - player.y) < b.radius + player.radius - 2) {
      b.life = 0;
      hurtPlayer();
      if (!player.alive) return;
    }
  }
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius - 4) {
      // Ramming kills the enemy too, at the cost of a hull hit.
      const died = e.takeDamage(99);
      if (died) killEnemy(e, false);
      hurtPlayer();
      if (!player.alive) return;
    }
  }
}

function collectPickups() {
  const got = pickups.collect(player);
  for (const kind of got) {
    sound.pickup();
    if (kind === 'gem') {
      addScore(PICKUPS.gemScore, player.x, player.y - 26);
    } else if (kind === 'hull') {
      player.heal(1);
      particles.floatText(player.x, player.y - 30, 'HULL +1', '#ff6b81', 16);
    } else if (kind === 'shield') {
      player.shield = PICKUPS.shieldSeconds;
      particles.floatText(player.x, player.y - 30, 'SHIELD', '#6ec6ff', 16);
    } else if (kind === 'overdrive') {
      player.overdrive = PICKUPS.overdriveSeconds;
      particles.floatText(player.x, player.y - 30, 'OVERDRIVE', '#ffd166', 16);
    }
  }
}

function updatePlaying(dt) {
  // Combo decay.
  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.comboCount = 0;
      game.comboMult = 1;
    }
  }
  if (game.bannerTimer > 0) game.bannerTimer -= dt;

  waves.update(dt, player, game.enemies);
  const fired = player.update(dt, input, VIEW, sound, particles);
  if (fired) {
    game.bullets.push(...fired);
    sound.shoot();
  }
  for (const e of game.enemies) {
    const shots = e.update(dt, player, rng);
    for (const s of shots) {
      game.bullets.push(s);
      sound.enemyShoot();
    }
  }
  updateBullets(dt);
  collideBullets();
  collidePlayer();
  pickups.update(dt, player);
  collectPickups();
  particles.update(dt);
  game.enemies = game.enemies.filter((e) => !e.dead);
  if (waves.isCleared(game.enemies) && player.alive) nextWave();
}

function updateStatus() {
  const el = document.getElementById('status');
  if (!el) return;
  const lines = {
    title: 'Lumen Drift. Press Enter to launch.',
    playing: `Wave ${game.wave}. Score ${game.score}. Hull ${player.hull} of ${player.hullMax}.`,
    draft: `Wave ${game.wave} cleared. Choose an upgrade.`,
    paused: 'Paused.',
    gameover: `Game over. Score ${game.score} on wave ${game.wave}. Press Enter to fly again.`,
    dying: 'Ship lost.',
  };
  el.textContent = lines[game.state] || '';
}

function drawFrame() {
  renderer.bannerT = game.bannerTimer > 0 ? game.bannerTimer / 1.6 : 0;
  if (game.state === 'title') {
    renderer.drawEnemies(game.enemies);
    renderer.drawTitle(game.best);
  } else {
    renderer.drawPickups(pickups);
    renderer.drawBullets(game.bullets);
    renderer.drawEnemies(game.enemies);
    renderer.drawPlayer(player);
    renderer.drawParticles(particles);
    renderer.drawHud({
      score: game.score,
      wave: game.wave,
      hull: Math.max(0, player.hull),
      hullMax: player.hullMax,
      comboCount: game.comboCount,
      comboMult: game.comboMult,
      comboFrac: Math.max(0, game.comboTimer / COMBO.windowSeconds),
      shield: player.shield,
      overdrive: player.overdrive,
      best: game.best,
      waveState: waves.queue.length > 0 ? 'incoming' : 'clear',
    });
    if (game.bannerTimer > 0 && game.state === 'playing') renderer.drawWaveBanner(game.bannerText);
    if (game.state === 'draft' && waves.draft) renderer.drawDraft(waves.draft, game.wave);
    if (game.state === 'paused') renderer.drawPaused();
    if (game.state === 'gameover') renderer.drawGameOver(game.score, game.wave, game.best, game.newBest);
  }
}

function handleGlobalKeys() {
  if (input.takePressed('KeyM')) sound.setMuted(!sound.muted);
  if (input.takePressed('KeyP') && (game.state === 'playing' || game.state === 'paused')) {
    game.state = game.state === 'playing' ? 'paused' : 'playing';
    updateStatus();
  }
  if (game.state === 'title' && (input.takePressed('Enter') || input.takePressed('Space') || input.mouseDown)) {
    sound.unlock();
    startGame();
  } else if (game.state === 'gameover' && (input.takePressed('Enter') || input.takePressed('Space') || input.mouseDown)) {
    sound.unlock();
    startGame();
  } else if (game.state === 'paused' && (input.takePressed('Enter') || input.mouseDown)) {
    game.state = 'playing';
    updateStatus();
  } else if (game.state === 'draft') {
    if (input.takePressed('Digit1')) chooseUpgrade(0);
    else if (input.takePressed('Digit2')) chooseUpgrade(1);
    else if (input.takePressed('Digit3')) chooseUpgrade(2);
    else if (input.mouseDown) {
      // Click a card: cards are laid out by drawDraft; recompute their boxes.
      const cw = 300;
      const ch = 190;
      const gap = 28;
      const total = cw * 3 + gap * 2;
      const startX = VIEW.width / 2 - total / 2;
      const y = 290;
      for (let i = 0; i < 3; i++) {
        const x = startX + i * (cw + gap);
        if (input.mouseX >= x && input.mouseX <= x + cw && input.mouseY >= y && input.mouseY <= y + ch) {
          chooseUpgrade(i);
          break;
        }
      }
    }
  }
}

// Decorative drifters behind the title screen.
function seedTitleScene() {
  game.enemies = [];
  const types = ['drifter', 'darter', 'weaver', 'splitter'];
  for (let i = 0; i < 7; i++) {
    const e = new Enemy(types[i % types.length], rng.range(80, VIEW.width - 80), rng.range(90, VIEW.height - 260), rng);
    game.enemies.push(e);
  }
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  game.frames += 1;
  handleGlobalKeys();
  renderer.beginFrame(dt);
  if (game.state === 'playing') {
    updatePlaying(dt);
  } else if (game.state === 'dying') {
    game.dyingTimer -= dt;
    particles.update(dt);
    updateBullets(dt);
    if (game.dyingTimer <= 0) gameOver();
  } else if (game.state === 'title') {
    for (const e of game.enemies) e.update(dt, { x: VIEW.width / 2, y: VIEW.height / 2, alive: false }, rng);
    particles.update(dt);
  }
  drawFrame();
  renderer.endFrame();
  input.clearPressed();
  if (!game.ready) {
    game.ready = true;
    window.__lumen.ready = true;
  }
  requestAnimationFrame(frame);
}

// Debug/testing hook: read-only state for automated play-tests.
window.__lumen = {
  get state() { return game.state; },
  get score() { return game.score; },
  get wave() { return game.wave; },
  get hull() { return player.hull; },
  get enemies() { return game.enemies.length; },
  get ready() { return game.ready; },
  set ready(v) { game.ready = v; },
  start: startGame,
};

// Screenshot mode: run the game headlessly through scripted play, then
// freeze on a representative frame. See shots.js.
const shots = new ShotDirector({ game, player, waves, input, rng, startGame, killEnemy, hurtPlayer, updatePlaying, drawFrame, renderer, nextWave });
if (shotMode) {
  seedTitleScene();
  shots.run(shotMode, () => {
    game.ready = true;
    window.__lumen.ready = true;
  });
  // Keep rendering the frozen frame so the screenshot sees a live canvas.
  requestAnimationFrame(function still(now) {
    renderer.beginFrame(0);
    drawFrame();
    renderer.endFrame();
    requestAnimationFrame(still);
  });
} else {
  seedTitleScene();
  updateStatus();
  requestAnimationFrame(frame);
}
