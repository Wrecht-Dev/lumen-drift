// Lumen Drift — deterministic random numbers.
// One clear job: a small seeded generator so screenshot runs and replays
// can reproduce the exact same field. Gameplay uses a time-seeded instance;
// screenshot mode uses a fixed seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Integer in [min, max] inclusive.
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // Pick one element of an array.
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    // Pick with weights: entries are { value, weight }.
    weighted(entries) {
      let total = 0;
      for (const e of entries) total += e.weight;
      let roll = next() * total;
      for (const e of entries) {
        roll -= e.weight;
        if (roll <= 0) return e.value;
      }
      return entries[entries.length - 1].value;
    },
    // Random angle in radians.
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
