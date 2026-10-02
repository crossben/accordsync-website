/** A seeded pseudo-random generator, so every simulator run can be replayed from its seed. */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], inclusive. */
  int(min: number, max: number): number;
}

/** mulberry32: small, fast, and good enough for scheduling faults; not for cryptography. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}
