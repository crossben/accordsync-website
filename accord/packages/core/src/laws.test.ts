/**
 * Strategy laws, checked against reference models.
 *
 * Random devices write and partially sync. Every op ever made is then replayed into fresh replicas
 * in shuffled orders, with duplicates. The tests assert:
 * - order independence and idempotency: every replay reads the same state;
 * - convergence: devices that end up with every op read that same state;
 * - each strategy matches its definition (sum of increments; add-wins set; highest clock;
 *   conflict values kept until an op that saw them supersedes them).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compareHlc } from './hlc';
import type { Op } from './op';
import { Replica } from './replica';
import { conflict, counter, defineSchema, lww, set } from './schema';
import { LocalWriter } from './writer';

const schema = defineSchema({
  dossier: { name: lww(), docs: set(), visits: counter(), status: conflict() },
});
const FIELDS = ['name', 'docs', 'visits', 'status'] as const;

type Action =
  | { t: 'write'; dev: number; rec: number; field: number; v: number; remove: boolean }
  | { t: 'sync'; from: number; to: number; mask: number };

const action: fc.Arbitrary<Action> = fc.oneof(
  fc.record({
    t: fc.constant('write' as const),
    dev: fc.nat(3),
    rec: fc.nat(1),
    field: fc.nat(3),
    v: fc.integer({ min: -3, max: 3 }),
    remove: fc.boolean(),
  }),
  fc.record({ t: fc.constant('sync' as const), from: fc.nat(3), to: fc.nat(3), mask: fc.nat() }),
);

const scenario = fc.record({
  devices: fc.integer({ min: 2, max: 4 }),
  // Phone clocks are wrong: each device runs up to an hour fast or slow.
  skews: fc.array(fc.integer({ min: -3_600_000, max: 3_600_000 }), { minLength: 4, maxLength: 4 }),
  actions: fc.array(action, { maxLength: 60 }),
  shuffleSeeds: fc.array(fc.integer(), { minLength: 3, maxLength: 3 }),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

function run(s: Scenario) {
  let tick = 1_700_000_000_000;
  const devs = Array.from(
    { length: s.devices },
    (_, i) => new LocalWriter({ schema, deviceId: `d${i}`, now: () => (tick += 7) + s.skews[i]! }),
  );
  const all: Op[] = [];
  for (const a of s.actions) {
    if (a.t === 'write') {
      const w = devs[a.dev % devs.length]!;
      const rec = `dossier:${a.rec}`;
      const field = FIELDS[a.field]!;
      if (field === 'name') all.push(w.assign(rec, field, `n${a.v}`));
      else if (field === 'status') all.push(w.assign(rec, field, `s${a.v}`));
      else if (field === 'visits') all.push(w.inc(rec, field, a.v));
      else if (a.remove) all.push(w.remove(rec, field, `doc${Math.abs(a.v) % 3}`));
      else all.push(w.add(rec, field, `doc${Math.abs(a.v) % 3}`));
    } else {
      const from = devs[a.from % devs.length]!;
      const to = devs[a.to % devs.length]!;
      // Deliver an arbitrary subset, in log order: partial syncs and lost messages.
      from.replica.ops().forEach((op, i) => {
        if ((a.mask >> (i % 31)) & 1) to.receive(op);
      });
    }
  }
  return { devs, all };
}

function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const out = [...xs];
  let x = seed | 1;
  for (let i = out.length - 1; i > 0; i--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const j = Math.abs(x) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function replay(ops: readonly Op[]): Replica {
  const r = new Replica(schema);
  for (const op of ops) r.apply(op);
  return r;
}

/** Reference models, computed straight from the definitions over the full op set. */
function model(all: readonly Op[], record: string) {
  const mine = all.filter((o) => o.record === record);
  const of = (f: string) => mine.filter((o) => o.field === f);

  const names = of('name').filter((o) => o.kind === 'assign');
  const lwwWinner = names.reduce<Op | undefined>(
    (w, o) => (!w || compareHlc(o.hlc, w.hlc) > 0 ? o : w),
    undefined,
  );

  const visits = of('visits').reduce((sum, o) => sum + (o.kind === 'inc' ? o.by : 0), 0);

  const removedTags = new Set(
    of('docs').flatMap((o) => (o.kind === 'remove' || o.kind === 'add' ? o.deps : [])),
  );
  const docs = [
    ...new Set(
      of('docs').flatMap((o) => (o.kind === 'add' && !removedTags.has(o.opId) ? [o.element] : [])),
    ),
  ].sort();

  const statuses = of('status').filter((o) => o.kind === 'assign');
  const superseded = new Set(statuses.flatMap((o) => (o.kind === 'assign' ? o.deps : [])));
  const live = statuses
    .filter((o) => !superseded.has(o.opId))
    .map((o) => ({ value: o.kind === 'assign' ? o.value : null, opId: o.opId }))
    .sort((a, b) => (a.opId < b.opId ? -1 : 1));
  const status =
    live.length === 0
      ? undefined
      : live.length === 1
        ? { value: live[0]!.value }
        : { conflicted: live };

  return {
    name: lwwWinner?.kind === 'assign' ? lwwWinner.value : undefined,
    docs,
    visits,
    status,
  };
}

const RUNS = Number(process.env.ACCORD_PROPERTY_RUNS ?? 300);

describe('strategy laws', () => {
  it('any delivery order, with duplicates, reads the same state', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { all } = run(s);
        const reference = replay(all).snapshot();
        for (const seed of s.shuffleSeeds) {
          const withDuplicates = shuffled([...all, ...all.slice(0, seed % 5)], seed);
          expect(replay(withDuplicates).snapshot()).toBe(reference);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('devices converge once every op is delivered', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { devs, all } = run(s);
        for (const d of devs) for (const op of shuffled(all, s.shuffleSeeds[0]!)) d.receive(op);
        const reference = replay(all).snapshot();
        for (const d of devs) expect(d.replica.snapshot()).toBe(reference);
      }),
      { numRuns: RUNS },
    );
  });

  it('each strategy matches its definition', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { all } = run(s);
        const r = replay(shuffled(all, s.shuffleSeeds[1]!));
        for (const record of r.records()) expect(r.read(record)).toEqual(model(all, record));
      }),
      { numRuns: RUNS },
    );
  });

  it('a conflict() field written concurrently is never auto-resolved', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (x, y) => {
        fc.pre(x !== y);
        let t = 0;
        const a = new LocalWriter({ schema, deviceId: 'a', now: () => t++ });
        const b = new LocalWriter({ schema, deviceId: 'b', now: () => t++ });
        const ops = [a.assign('dossier:1', 'status', x), b.assign('dossier:1', 'status', y)];
        a.receive(ops[1]!);
        b.receive(ops[0]!);
        for (const w of [a, b]) {
          expect(w.replica.conflicts()).toEqual([{ record: 'dossier:1', field: 'status' }]);
        }
      }),
      { numRuns: RUNS },
    );
  });
});
