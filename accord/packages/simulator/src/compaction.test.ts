/**
 * Compaction law (ADR-0008): on the server feed, which is causally ordered, folding any prefix of a
 * record's ops into a snapshot and applying the rest gives exactly the state of applying everything.
 */
import { Replica } from '@accordsync/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, replay, SIM_SCHEMA, simulate } from './simulation';

const RUNS = Number(process.env.ACCORD_SIM_RUNS ?? 200) / 4;

describe('compaction', () => {
  it('snapshot(prefix) + rest = everything, at any cut point, repeatedly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 3 }),
        (seed, cuts) => {
          const { accepted } = simulate({ ...DEFAULT_CONFIG, seed, durationMs: 30_000 });
          const expected = replay(accepted).snapshot();
          // Compact at increasing cut points, each time keeping only the snapshot and later ops.
          let base = new Replica(SIM_SCHEMA);
          let from = 0;
          for (const cut of [...cuts].sort()) {
            const to = Math.max(from, Math.floor(cut * accepted.length));
            for (const op of accepted.slice(from, to)) base.apply(op);
            const next = new Replica(SIM_SCHEMA);
            for (const record of base.records()) next.loadSnapshot(base.snapshotRecord(record));
            base = next;
            from = to;
          }
          for (const op of accepted.slice(from)) base.apply(op);
          expect(base.snapshot()).toBe(expected);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('dropping tombstones is safe because removes and resolutions follow what they cite', () => {
    const { accepted } = simulate({ ...DEFAULT_CONFIG, seed: 7 });
    const position = new Map(accepted.map((op, i) => [op.opId, i]));
    for (const [i, op] of accepted.entries()) {
      if (op.kind !== 'assign' && op.kind !== 'remove') continue;
      for (const dep of op.deps) {
        const at = position.get(dep);
        if (at !== undefined) expect(at, `${op.opId} cites ${dep}`).toBeLessThan(i);
      }
    }
  });

  it('a rollback after a snapshot keeps the snapshot', () => {
    const { accepted } = simulate({ ...DEFAULT_CONFIG, seed: 3 });
    const half = Math.floor(accepted.length / 2);
    const r = new Replica(SIM_SCHEMA);
    for (const op of accepted.slice(0, half)) r.apply(op);
    const compacted = new Replica(SIM_SCHEMA);
    for (const record of r.records()) compacted.loadSnapshot(r.snapshotRecord(record));
    for (const op of accepted.slice(half)) compacted.apply(op);
    const last = accepted[accepted.length - 1]!;
    const expected = replay(accepted.filter((o) => o.opId !== last.opId)).snapshot();
    expect(compacted.without(new Set([last.opId])).snapshot()).toBe(expected);
  });
});
