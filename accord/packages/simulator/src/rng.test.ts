import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const take = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
  it('replays the same sequence for the same seed', () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it('keeps int() within bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(3);
    }
  });
});
