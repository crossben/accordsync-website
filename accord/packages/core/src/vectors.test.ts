import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical';
import type { Op } from './op';
import { Replica } from './replica';
import { defineSchema, type Schema, type StrategyName } from './schema';
import { decodeOp } from './wire';

const dir = join(import.meta.dirname, '../../../vectors');

interface VectorFile {
  version: number;
  strategy: string;
  schema: Record<string, Record<string, StrategyName>>;
  cases: { name: string; ops: unknown[]; expected: Record<string, unknown> }[];
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]),
  );
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('golden vectors', () => {
  it('exist for every strategy', () => {
    expect(files.sort()).toEqual(['conflict.json', 'counter.json', 'lww.json', 'set.json']);
  });

  for (const file of files) {
    const v = JSON.parse(readFileSync(join(dir, file), 'utf8')) as VectorFile;
    const schema: Schema = defineSchema(
      Object.fromEntries(
        Object.entries(v.schema).map(([t, fields]) => [
          t,
          Object.fromEntries(Object.entries(fields).map(([f, s]) => [f, { strategy: s }])),
        ]),
      ),
    );
    for (const c of v.cases) {
      it(`${file}: ${c.name}`, () => {
        expect(v.version).toBe(1);
        const ops: Op[] = c.ops.map(decodeOp);
        for (const order of permutations(ops)) {
          const r = new Replica(schema);
          for (const op of [...order, ...order]) r.apply(op);
          expect(r.snapshot()).toBe(canonicalJson(c.expected));
        }
      });
    }
  }
});
