// Lumen Drift — tuning, palette and shared constants.
// One clear job: every number the game balances on lives here, so tuning
// never means hunting through logic files.

export const VIEW = { width: 1280, height: 800 };

export const PALETTE = {
  backgroundTop: '#070a1a',
  backgroundBottom: '#120826',
  starDim: 'rgba(180, 200, 255, 0.5)',
  starBright: 'rgba(220, 235, 255, 0.9)',
  grid: 'rgba(90, 120, 255, 0.07)',
  player: '#7df9ff',
  playerCore: '#ffffff',
  bullet: '#ffe066',
  bulletGlow: 'rgba(255, 224, 102, 0.55)',
  enemyDrifter: '#ff5d8f',
  enemyDarter: '#ffb347',
  enemyWeaver: '#b388ff',
  enemySplitter: '#4ade80',
  enemyBoss: '#ff3b30',
  enemyBullet: '#ff8fa3',
  gem: '#5ef2b8',
  hull: '#ff6b81',
  shield: '#6ec6ff',
  overdrive: '#ffd166',
  text: '#eaf2ff',
  textDim: '#9db4d8',
  accent: '#ffd166',
  danger: '#ff5d5d',
  panel: 'rgba(10, 16, 40, 0.82)',
  panelBorder: 'rgba(125, 249, 255, 0.35)',
};

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 340,
  drag: 0.86, // per-frame velocity retention at 60fps, applied as pow(drag, dt*60)
  turnRate: 9,
  hullMax: 3,
  invulnSeconds: 1.6,
  fireInterval: 0.16,
  bulletSpeed: 720,
  bulletRadius: 5,
  bulletDamage: 1,
  bulletLife: 0.9,
  dyingSeconds: 1.7, // death animation before the SHIP LOST screen
};

export const COMBO = {
  windowSeconds: 4, // a kill refreshes the window; it drains after this long
  maxMultiplier: 8,
  perKill: 1, // combo count gained per kill
};

export const WAVES = {
  // How many enemies a wave fields, before the per-type mix below.
  baseCount: 6,
  perWave: 3,
  bossEvery: 5,
  // Seconds between spawn ticks; shrinks as waves climb.
  spawnIntervalStart: 1.15,
  spawnIntervalMin: 0.35,
  spawnIntervalFalloff: 0.06,
  // Points for clearing a wave, before the wave multiplier.
  clearBonus: 100,
  betweenWaveSeconds: 2.5,
};

// Enemy stat table. Speeds are px/s; hp in player-bullet hits.
export const ENEMIES = {
  drifter: {
    name: 'Drifter',
    radius: 18,
    hp: 2,
    speed: 95,
    score: 50,
    sides: 3,
    color: PALETTE.enemyDrifter,
    behavior: 'chase',
  },
  darter: {
    name: 'Darter',
    radius: 13,
    hp: 1,
    speed: 240,
    score: 80,
    sides: 4,
    color: PALETTE.enemyDarter,
    behavior: 'lunge',
    lungeCooldown: 2.2,
    lungeSpeed: 520,
    lungeTime: 0.45,
  },
  weaver: {
    name: 'Weaver',
    radius: 17,
    hp: 3,
    speed: 70,
    score: 120,
    sides: 5,
    color: PALETTE.enemyWeaver,
    behavior: 'shoot',
    shootCooldown: 2.6,
    bulletSpeed: 210,
    keepDistance: 300,
  },
  splitter: {
    name: 'Splitter',
    radius: 24,
    hp: 3,
    speed: 70,
    score: 150,
    sides: 6,
    color: PALETTE.enemySplitter,
    behavior: 'chase',
    children: 2,
  },
  warden: {
    name: 'Warden',
    radius: 52,
    hp: 60,
    speed: 45,
    score: 1500,
    sides: 8,
    color: PALETTE.enemyBoss,
    behavior: 'boss',
    shootCooldown: 1.9,
    bulletSpeed: 190,
    burstCount: 10,
  },
};

// Wave composition: which types may appear from which wave on.
export const WAVE_MIX = [
  { type: 'drifter', fromWave: 1, weight: 10 },
  { type: 'darter', fromWave: 2, weight: 6 },
  { type: 'weaver', fromWave: 3, weight: 5 },
  { type: 'splitter', fromWave: 4, weight: 4 },
];

export const PICKUPS = {
  gemScore: 25,
  gemMagnetRadius: 130,
  hullChance: 0.06, // per kill
  shieldChance: 0.05,
  overdriveChance: 0.04,
  shieldSeconds: 10,
  overdriveSeconds: 6,
  overdriveFireInterval: 0.07,
  despawnSeconds: 12,
};

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Cycler',
    desc: '+25% fire rate',
    icon: { sides: 3, rotation: 0 },
    apply: (s) => { s.fireInterval *= 0.75; },
  },
  {
    id: 'heavy',
    name: 'Heavy Rounds',
    desc: '+1 bullet damage',
    icon: { sides: 4, rotation: 0 },
    apply: (s) => { s.bulletDamage += 1; },
  },
  {
    id: 'twin',
    name: 'Twin Mount',
    desc: '+1 projectile per shot',
    icon: { sides: 6, rotation: 0 },
    apply: (s) => { s.projectiles += 1; },
  },
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    desc: 'Shots pass through +1 enemy',
    icon: { sides: 5, rotation: 0 },
    apply: (s) => { s.pierce += 1; },
  },
  {
    id: 'thrusters',
    name: 'Ion Thrusters',
    desc: '+15% move speed',
    icon: { sides: 3, rotation: Math.PI },
    apply: (s) => { s.maxSpeed *= 1.15; },
  },
  {
    id: 'plating',
    name: 'Ablative Plating',
    desc: '+1 max hull, repair 1',
    icon: { sides: 8, rotation: 0 },
    apply: (s) => { s.hullMax += 1; s.hull = Math.min(s.hullMax, s.hull + 1); },
  },
  {
    id: 'magnet',
    name: 'Tractor Web',
    desc: 'Gems fly to you from farther away',
    icon: { sides: 4, rotation: Math.PI / 4 },
    apply: (s) => { s.magnetRadius *= 1.8; },
  },
  {
    id: 'velocity',
    name: 'Rail Coils',
    desc: '+20% bullet speed and range',
    icon: { sides: 7, rotation: 0 },
    apply: (s) => { s.bulletSpeed *= 1.2; s.bulletLife *= 1.2; },
  },
];

export const STORAGE_BEST_KEY = 'lumen-drift-best';
