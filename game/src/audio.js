// Lumen Drift — sound: every effect and the music loop, synthesized live
// with WebAudio. No audio files are shipped; nothing is fetched.
// One clear job: turn game events into sound, and keep a quiet bass pulse
// running under play. Muted until the player first interacts (browsers
// require a gesture before audio starts).

const NOTE_FREQ = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0,
};

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.started = false;
    this.musicTimer = null;
    this.musicStep = 0;
    // A slow minor pulse: root notes with a soft triangle wave.
    this.bassLine = ['C2', 'C2', 'G2', 'A2', 'F2', 'F2', 'G2', 'G2'];
  }

  // Call from the first user gesture. Safe to call repeatedly.
  unlock() {
    if (this.started) {
      if (this.context && this.context.state === 'suspended') this.context.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.started = true;
    } catch {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.02);
    }
  }

  // One short oscillator blip with a pitch slide and a decay envelope.
  blip({ type = 'square', from = 440, to = null, duration = 0.08, volume = 0.2, when = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Filtered noise burst, for explosions and impacts.
  noise({ duration = 0.25, volume = 0.3, cutoff = 1200, when = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + when;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  shoot() { this.blip({ type: 'square', from: 880, to: 320, duration: 0.07, volume: 0.10 }); }
  enemyShoot() { this.blip({ type: 'sawtooth', from: 300, to: 180, duration: 0.12, volume: 0.08 }); }
  hit() { this.blip({ type: 'triangle', from: 220, to: 140, duration: 0.06, volume: 0.14 }); }
  explode(big = false) {
    this.noise({ duration: big ? 0.5 : 0.28, volume: big ? 0.4 : 0.25, cutoff: big ? 900 : 1600 });
    this.blip({ type: 'sine', from: big ? 160 : 220, to: 40, duration: big ? 0.45 : 0.25, volume: 0.3 });
  }
  pickup() {
    this.blip({ type: 'sine', from: 660, to: 990, duration: 0.09, volume: 0.16 });
    this.blip({ type: 'sine', from: 990, to: 1320, duration: 0.1, volume: 0.14, when: 0.07 });
  }
  hurt() {
    this.noise({ duration: 0.3, volume: 0.3, cutoff: 700 });
    this.blip({ type: 'sawtooth', from: 200, to: 60, duration: 0.3, volume: 0.22 });
  }
  waveClear() {
    [523, 659, 784].forEach((f, i) => this.blip({ type: 'triangle', from: f, duration: 0.16, volume: 0.16, when: i * 0.09 }));
  }
  waveStart() { this.blip({ type: 'sawtooth', from: 110, to: 220, duration: 0.35, volume: 0.16 }); }
  upgrade() {
    [392, 523, 659, 784].forEach((f, i) => this.blip({ type: 'triangle', from: f, duration: 0.12, volume: 0.14, when: i * 0.06 }));
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.blip({ type: 'triangle', from: f, duration: 0.3, volume: 0.18, when: i * 0.16 }));
  }

  startMusic() {
    if (!this.context || this.musicTimer) return;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.context) return;
      const note = this.bassLine[this.musicStep % this.bassLine.length];
      const freq = NOTE_FREQ[note];
      const t0 = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.5);
      this.musicStep += 1;
    }, 240);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
