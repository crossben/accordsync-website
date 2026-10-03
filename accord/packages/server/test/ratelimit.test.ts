import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/ratelimit';

describe('RateLimiter', () => {
  it('allows a burst, then throttles, then refills over time', () => {
    let now = 0;
    const rl = new RateLimiter({ perMinute: 60, burst: 3 }, () => now);
    expect([rl.take('a'), rl.take('a'), rl.take('a')]).toEqual([0, 0, 0]);
    expect(rl.take('a')).toBe(1000); // one token per second
    now += 1000;
    expect(rl.take('a')).toBe(0);
    expect(rl.take('a')).toBeGreaterThan(0);
  });

  it('keeps keys independent', () => {
    const rl = new RateLimiter({ perMinute: 1, burst: 1 }, () => 0);
    expect(rl.take('a')).toBe(0);
    expect(rl.take('b')).toBe(0);
    expect(rl.take('a')).toBeGreaterThan(0);
  });

  it('bounds memory by evicting full buckets', () => {
    let now = 0;
    const rl = new RateLimiter({ perMinute: 60, burst: 1 }, () => now, 2);
    rl.take('a');
    rl.take('b');
    now += 10_000; // a and b are full again
    expect(rl.take('c')).toBe(0);
    expect(rl.take('a')).toBe(0); // recreated as new: same behaviour as a full bucket
  });
});
