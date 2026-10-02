/**
 * The definition of done for Accord: under random network faults, every replica converges.
 *
 * Each case is one seeded simulation: devices with wrong clocks write offline and online, while the
 * network drops, delays, duplicates and reorders messages and partitions devices. Then the network
 * heals, and the test asserts that every device and the server hold exactly the state a clean
 * replay of every op produces.
 *
 * A failure prints its seed. Replay it with: ACCORD_SIM_SEED=<seed> pnpm --filter @accordsync/simulator test
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, replay, type SimConfig, simulate } from './simulation';

const RUNS = Number(process.env.ACCORD_SIM_RUNS ?? 200);
const ONLY_SEED = process.env.ACCORD_SIM_SEED;

const config: fc.Arbitrary<SimConfig> = fc.record({
  seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
  devices: fc.integer({ min: 2, max: 5 }),
  durationMs: fc.integer({ min: 5_000, max: 90_000 }),
  writeEveryMs: fc.integer({ min: 200, max: 4_000 }),
  syncEveryMs: fc.integer({ min: 500, max: 5_000 }),
  timeoutMs: fc.integer({ min: 1_000, max: 8_000 }),
  batchSize: fc.integer({ min: 1, max: 10 }),
  pageSize: fc.integer({ min: 1, max: 10 }),
  dropRate: fc.double({ min: 0, max: 0.5, noNaN: true }),
  duplicateRate: fc.double({ min: 0, max: 0.3, noNaN: true }),
  minDelayMs: fc.constant(5),
  maxDelayMs: fc.integer({ min: 5, max: 6_000 }),
  partitionRate: fc.double({ min: 0, max: 0.3, noNaN: true }),
  maxPartitionMs: fc.integer({ min: 1, max: 60_000 }),
  maxClockErrorMs: fc.integer({ min: 0, max: 3 * 3_600_000 }),
  maxSkewMs: fc.constant(DEFAULT_CONFIG.maxSkewMs),
  restrictD0: fc.boolean(),
});

function assertConverged(c: SimConfig): void {
  const r = simulate(c);
  const expected = replay(r.accepted).snapshot();
  // Every op is either accepted by the server or refused and rolled back on its device.
  expect(r.accepted.length + r.refused, `seed ${c.seed}: every op accounted for`).toBe(
    r.ops.length,
  );
  if (!c.restrictD0) expect(r.refused, `seed ${c.seed}: nothing to refuse`).toBe(0);
  expect(r.serverSnapshot, `seed ${c.seed}: server`).toBe(expected);
  r.deviceSnapshots.forEach((s, i) => expect(s, `seed ${c.seed}: device d${i}`).toBe(expected));

  // No lost increments: every counter equals the sum of every increment ever made.
  const sums = new Map<string, number>();
  for (const op of r.accepted) {
    if (op.kind === 'inc') sums.set(op.record, (sums.get(op.record) ?? 0) + op.by);
  }
  const final = replay(r.accepted);
  for (const [record, sum] of sums) expect(final.read(record)?.visits).toBe(sum);
}

describe('convergence under network faults', () => {
  if (ONLY_SEED !== undefined) {
    it(`replays seed ${ONLY_SEED}`, () => {
      assertConverged({ ...DEFAULT_CONFIG, seed: Number(ONLY_SEED) });
    });
    return;
  }

  it(
    'every replica converges, whatever the network does',
    () => {
      fc.assert(
        fc.property(config, (c) => assertConverged(c)),
        { numRuns: RUNS },
      );
    },
    RUNS * 100,
  );

  it('the default scenario actually exercises faults', () => {
    const totals = { dropped: 0, duplicated: 0, partitions: 0, ops: 0 };
    for (let seed = 0; seed < 20; seed++) {
      const r = simulate({ ...DEFAULT_CONFIG, seed });
      totals.dropped += r.stats.dropped;
      totals.duplicated += r.stats.duplicated;
      totals.partitions += r.stats.partitions;
      totals.ops += r.ops.length;
    }
    expect(totals.dropped).toBeGreaterThan(0);
    expect(totals.duplicated).toBeGreaterThan(0);
    expect(totals.partitions).toBeGreaterThan(0);
    expect(totals.ops).toBeGreaterThan(100);
  });

  it('refused writes are rolled back on the device that made them', () => {
    let refused = 0;
    for (let seed = 0; seed < 20; seed++) {
      const c = { ...DEFAULT_CONFIG, seed, restrictD0: true };
      assertConverged(c);
      refused += simulate(c).refused;
    }
    expect(refused).toBeGreaterThan(0);
  });

  it('a seed replays exactly', () => {
    const a = simulate({ ...DEFAULT_CONFIG, seed: 1234 });
    const b = simulate({ ...DEFAULT_CONFIG, seed: 1234 });
    expect(a.trace).toEqual(b.trace);
    expect(a.trace.length).toBeGreaterThan(50);
    expect(simulate({ ...DEFAULT_CONFIG, seed: 1235 }).trace).not.toEqual(a.trace);
  });

  it('a device offline for a long time catches up through many pages', () => {
    const r = simulate({
      ...DEFAULT_CONFIG,
      seed: 99,
      devices: 4,
      durationMs: 600_000,
      writeEveryMs: 300,
      pageSize: 3,
      partitionRate: 0.5,
      maxPartitionMs: 300_000,
    });
    expect(r.ops.length).toBeGreaterThan(1_000);
    const expected = replay(r.accepted).snapshot();
    r.deviceSnapshots.forEach((s) => expect(s).toBe(expected));
  });
});
