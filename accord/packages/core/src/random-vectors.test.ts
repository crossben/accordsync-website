/**
 * Random vectors: seeded scenarios with awkward values, written by this core to
 * `vectors/random/cases.json` with the snapshots it reads. Other implementations (the Dart port)
 * must reproduce every snapshot byte for byte, which checks canonical JSON (key order, number and
 * string formatting) as well as the merge itself.
 *
 * The file is regenerated here and compared, so it can never drift from the code. To rewrite it
 * after an intended change: `ACCORD_WRITE_VECTORS=1 pnpm --filter @accordsync/core test`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical';
import type { JsonValue, Op } from './op';
import { Replica } from './replica';
import { conflict, counter, defineSchema, lww, set } from './schema';
import { encodeOp } from './wire';
import { LocalWriter } from './writer';

const file = join(import.meta.dirname, '../../../vectors/random/cases.json');

const SCHEMA_JSON = {
  // Integer-like field names: JavaScript puts them first in objects, in numeric order.
  item: { '10': 'lww', '9': 'counter', b: 'set', a: 'conflict', é: 'lww' },
} as const;
const schema = defineSchema({
  item: { '10': lww(), '9': counter(), b: set(), a: conflict(), é: lww() },
});

// Mixed case and symbols: op ids must sort by code unit ('B' < '_' < 'a'), never case-folded.
const DEVICES = ['a', 'B', '_x', 'z-9'];
const NUMBERS = [0, -0, 1, -1, 0.1, 0.5, 1e21, 1e-7, 123456789.125, 2 ** 53 - 1, 5e-324, -1.5e300];
const STRINGS = [
  '',
  'a',
  'B',
  'é',
  'é',
  '😀',
  '\u0000\u001f',
  'line\nbreak',
  '"q"\\',
  ' ',
  '\ud800',
  '10',
  '9',
  // Private-use and U+FFFx: above every surrogate in code points, below them in UTF-16 code units.
  // With '😀' they catch any port sorting by code point or by UTF-8 bytes instead of UTF-16.
  '\ue000',
  '\uffef',
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(seed: number) {
  const rnd = mulberry32(seed);
  const int = (n: number) => Math.floor(rnd() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]!;
  const value = (depth = 0): JsonValue => {
    switch (int(depth > 1 ? 4 : 6)) {
      case 0:
        return null;
      case 1:
        return rnd() < 0.5;
      case 2:
        return pick(NUMBERS);
      case 3:
        return pick(STRINGS);
      case 4:
        return Array.from({ length: int(4) }, () => value(depth + 1));
      default: {
        const o: Record<string, JsonValue> = {};
        for (let i = int(4); i > 0; i--)
          o[pick([...STRINGS, '0', '1', '4294967295', 'x'])] = value(depth + 1);
        return o;
      }
    }
  };
  const element = () => (rnd() < 0.5 ? pick(NUMBERS) : pick(STRINGS));

  let tick = 1_700_000_000_000;
  const devs = DEVICES.slice(0, 2 + int(3)).map((deviceId) => {
    const skew = int(7_200_001) - 3_600_000;
    return new LocalWriter({ schema, deviceId, now: () => (tick += 1 + int(3)) + skew });
  });
  const records = ['item:1', 'item:10', 'item:9', 'item:é'];
  const ops: Op[] = [];
  for (let n = 10 + int(40); n > 0; n--) {
    if (rnd() < 0.7) {
      const w = pick(devs);
      const rec = pick(records);
      const field = pick(['10', '9', 'b', 'a', 'é'] as const);
      if (field === '9') ops.push(w.inc(rec, field, int(11) - 5));
      else if (field === 'b') {
        // Removing an element that is present keeps sets interesting.
        const present = w.replica.read(rec)?.b as (string | number)[] | undefined;
        if (present?.length && rnd() < 0.4) ops.push(w.remove(rec, field, pick(present)));
        else ops.push(w.add(rec, field, element()));
      } else ops.push(w.assign(rec, field, value()));
    } else {
      const from = pick(devs);
      const to = pick(devs);
      for (const op of from.replica.ops()) if (rnd() < 0.6) to.receive(op);
    }
  }
  const r = new Replica(schema);
  for (const op of ops) r.apply(op);
  return {
    seed,
    ops: ops.map(encodeOp),
    snapshot: r.snapshot(),
    records: Object.fromEntries(
      r.records().map((rec) => [rec, canonicalJson(r.snapshotRecord(rec))]),
    ),
  };
}

function render(): string {
  const cases = Array.from({ length: 40 }, (_, i) => generate(i + 1));
  return `${JSON.stringify({ version: 1, schema: SCHEMA_JSON, cases }, null, 1)}\n`;
}

describe('random vectors', () => {
  it('vectors/random/cases.json matches what this core produces', () => {
    const fresh = render();
    if (process.env.ACCORD_WRITE_VECTORS) {
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, fresh);
    }
    expect(readFileSync(file, 'utf8')).toBe(fresh);
  });
});
