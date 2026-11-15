// Lumen Drift — screenshot mode: drive the real game through scripted play
// so the screenshots are true renders of the game's own code, at a fixed
// seed. Triggered only by ?shot=start|play|upgrade|end in the page URL.
// One clear job: stage a representative frame for each screenshot.

const DT = 1 / 60;

export class ShotDirector {
  constructor(deps) {
    this.game = deps.game;
    this.player = deps.player;
    this.waves = deps.waves;
    this.input = deps.input;
    this.rng = deps.rng;
    this.startGame = deps.startGame;
    this.gameOver = deps.gameOver;
    this.killEnemy = deps.killEnemy;
    this.hurtPlayer = deps.hurtPlayer;
    this.updatePlaying = deps.updatePlaying;
    this.drawFrame = deps.drawFrame;
    this.renderer = deps.renderer;
  }

  // One fixed-timestep step of the world, with scripted input.
  // Mirrors the live frame loop: while dying, only the death timer runs.
  step(script) {
    if (script) script(this);
    if (this.game.state === 'dying') {
      this.game.dyingTimer -= DT;
      if (this.game.dyingTimer <= 0) this.gameOver();
    } else {
      this.updatePlaying(DT);
    }
    this.renderer.beginFrame(DT);
    this.drawFrame();
    this.renderer.endFrame();
  }

  // If a wave cleared mid-sim, take the first upgrade and start the next
  // wave so the sim keeps playing instead of stalling on the draft screen.
  advanceDraft() {
    const g = this.game;
    if (g.state === 'draft' && this.waves.draft) {
      this.waves.applyDraft(0, this.player);
      this.waves.startWave(this.waves.wave + 1);
      g.state = 'playing';
    }
  }

  // Aim at the nearest enemy, hold fire, and drift in a slow orbit so the
  // play shot shows movement, bullets and kills.
  combatScript() {
    const g = this.game;
    const p = this.player;
    let target = null;
    let best = Infinity;
    for (const e of g.enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < best) { best = d; target = e; }
    }
    if (target) {
      this.input.mouseX = target.x;
      this.input.mouseY = target.y;
    } else {
      this.input.mouseX = p.x + Math.cos(g.frames * 0.01) * 200;
      this.input.mouseY = p.y + Math.sin(g.frames * 0.01) * 200;
    }
    this.input.mouseDown = true;
    // Orbit the arena center so the ship is rarely still.
    const t = g.frames * DT;
    const cx = 640 + Math.cos(t * 0.45) * 260;
    const cy = 430 + Math.sin(t * 0.6) * 180;
    this.input.keys.clear();
    if (p.x < cx - 12) this.input.keys.add('KeyD');
    if (p.x > cx + 12) this.input.keys.add('KeyA');
    if (p.y < cy - 12) this.input.keys.add('KeyS');
    if (p.y > cy + 12) this.input.keys.add('KeyW');
    g.frames += 1;
  }

  // Idle script: no firing, no movement — the player dies on its own.
  idleScript() {
    this.input.mouseDown = false;
    this.input.keys.clear();
    this.game.frames += 1;
  }

  run(mode, done) {
    const g = this.game;
    if (mode === 'start') {
      // Title screen as seeded by main.js; nothing to play.
      done();
      return;
    }
    if (mode === 'play') {
      this.startGame();
      // Fight into wave 2+ and freeze while the arena is still busy:
      // wave 1 alone is mostly cleared by the time the scripted ship
      // stops, which left a near-empty frame. Wait for a moment with
      // several enemies up AND the ship near the middle of the field,
      // so the frame reads as an arena in full swing even at 256 px.
      // Cap the sim so a bad seed still produces a frame, not a hang.
      let i = 0;
      for (; i < 60 * 40; i++) {
        this.advanceDraft();
        this.step(() => this.combatScript());
        const centered = Math.abs(this.player.x - 640) < 220 && Math.abs(this.player.y - 400) < 160;
        if (this.waves.wave >= 2 && this.game.enemies.length >= 4 && centered) break;
      }
      this.input.mouseDown = false;
      done();
      return;
    }
    if (mode === 'upgrade') {
      this.startGame();
      let i = 0;
      for (; i < 60 * 150 && g.state !== 'draft'; i++) this.step(() => this.combatScript());
      if (g.state !== 'draft') {
        // Finish the wave through the game's own kill path, then let the
        // clear trigger the draft screen.
        for (const e of [...g.enemies]) {
          if (!e.dead) this.killEnemy(e);
        }
        for (let j = 0; j < 30 && g.state !== 'draft'; j++) this.step(() => this.combatScript());
      }
      this.input.mouseDown = false;
      done();
      return;
    }
    if (mode === 'end') {
      this.startGame();
      // Earn a real score first, then stop fighting and die.
      for (let i = 0; i < 60 * 8; i++) this.step(() => this.combatScript());
      this.input.mouseDown = false;
      // The combat above usually clears wave 1, which parks the game on
      // the draft screen — idling there never kills the player.
      this.advanceDraft();
      let i = 0;
      for (; i < 60 * 150 && g.state !== 'gameover'; i++) {
        this.advanceDraft();
        this.step(() => this.idleScript());
      }
      if (g.state !== 'gameover') {
        // Force the end through the game's own damage path.
        for (let k = 0; k < 3 && g.state !== 'gameover'; k++) {
          this.player.invuln = 0;
          this.player.shield = 0;
          this.hurtPlayer();
          // Dying lasts PLAYER.dyingSeconds (1.7 s = 102 frames); step
          // well past it so the SHIP LOST screen is showing at capture,
          // not the explosion mid-frame.
          for (let j = 0; j < 150 && g.state !== 'gameover'; j++) this.step(() => this.idleScript());
        }
      }
      if (g.state !== 'gameover') {
        throw new Error(`shot 'end' did not reach gameover (state=${g.state}, score=${g.score})`);
      }
      done();
      return;
    }
    done();
  }
}
