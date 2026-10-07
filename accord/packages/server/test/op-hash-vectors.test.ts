/**
 * Golden vectors for `op_hash` (ADR-0010, update of 2026-10-06): the hash a compacted op is
 * remembered by, stored in the shared database, so every server implementation must compute it
 * byte for byte the same. Written by this server to `vectors/op-hash/op-hash.json`.
 *
 * The file is regenerated here and compared, so it can never drift from the code. To rewrite it
 * after an intended change: `ACCORD_WRITE_VECTORS=1 pnpm --filter @accordsync/server test`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canonicalJson, decodeOp, encodeOp } from '@accordsync/core';
import { describe, expect, it } from 'vitest';
import { opHash } from '../src/sync';

const file = join(import.meta.dirname, '../../../vectors/op-hash/op-hash.json');

// JSON.stringify writes -0 as 0; this placeholder is replaced by a literal -0 in the file.
const NEG_ZERO = '__accord_negative_zero__';

const base = (n: number, field: string, record = 'dossier:1') => ({
  op_id: `dev-A:${n}`,
  record,
  field,
  hlc: `1767225600000:${String(n).padStart(5, '0')}:dev-A`,
});

const CASES: { name: string; op: Record<string, unknown> }[] = [
  {
    name: 'assign a string, no deps',
    op: { ...base(1, 'agent'), kind: 'assign', value: 'awa', deps: [] },
  },
  {
    name: 'assign with deps',
    op: { ...base(2, 'status'), kind: 'assign', value: 'draft', deps: ['dev-B:7', 'dev-A:1'] },
  },
  { name: 'inc', op: { ...base(3, 'visits'), kind: 'inc', by: 3 } },
  { name: 'inc by a negative number', op: { ...base(4, 'visits'), kind: 'inc', by: -2 } },
  {
    name: 'add without deps (first add)',
    op: { ...base(5, 'docs'), kind: 'add', element: 'cni.pdf' },
  },
  {
    name: 'add with deps',
    op: { ...base(6, 'docs'), kind: 'add', element: 'cni.pdf', deps: ['dev-A:5'] },
  },
  { name: 'add a number', op: { ...base(7, 'docs'), kind: 'add', element: 42 } },
  {
    name: 'remove',
    op: { ...base(8, 'docs'), kind: 'remove', element: 'cni.pdf', deps: ['dev-A:5', 'dev-A:6'] },
  },
  {
    name: 'non-ASCII',
    op: { ...base(9, 'agent'), kind: 'assign', value: 'Thiès, Sénégal', deps: [] },
  },
  {
    name: 'emoji (astral)',
    op: { ...base(10, 'agent'), kind: 'assign', value: 'ok 😀', deps: [] },
  },
  {
    name: 'U+E000 and U+FFEF (sort above surrogates by code point, below by code unit)',
    op: { ...base(11, 'agent'), kind: 'assign', value: { '': 1, '😀': 2, '￯': 3 }, deps: [] },
  },
  {
    name: 'integer-like keys: array-index keys first, in numeric order, then the rest by code unit',
    op: {
      ...base(12, 'agent'),
      kind: 'assign',
      value: { '10': 'a', '9': 'b', a: 'c', '1': 'd' },
      deps: [],
    },
  },
  { name: '1e21', op: { ...base(13, 'agent'), kind: 'assign', value: 1e21, deps: [] } },
  { name: '1e-7', op: { ...base(14, 'agent'), kind: 'assign', value: 1e-7, deps: [] } },
  {
    name: '-0 (as JSON.parse reads it)',
    op: { ...base(15, 'agent'), kind: 'assign', value: NEG_ZERO, deps: [] },
  },
  {
    name: 'decimals',
    op: { ...base(16, 'agent'), kind: 'assign', value: [0.1, 1.5, -1.5e300, 5e-324], deps: [] },
  },
  {
    name: 'nested objects',
    op: {
      ...base(17, 'agent'),
      kind: 'assign',
      value: { z: { b: [1, { y: true, x: null }], a: 'é' }, a: [] },
      deps: [],
    },
  },
  { name: 'empty object', op: { ...base(18, 'agent'), kind: 'assign', value: {}, deps: [] } },
  { name: 'empty array', op: { ...base(19, 'agent'), kind: 'assign', value: [], deps: [] } },
  { name: 'null value', op: { ...base(20, 'agent'), kind: 'assign', value: null, deps: [] } },
  {
    name: 'escapes: quote, backslash, control characters, U+2028',
    op: { ...base(21, 'agent'), kind: 'assign', value: '"q"\\ \n\t\u0000\u001f ', deps: [] },
  },
  {
    name: 'mixed-case device and record ids',
    op: {
      op_id: 'Tab_9:1',
      record: 'dossier:Ab-é',
      field: 'zone',
      hlc: '1767225600000:00000:Tab_9',
      kind: 'assign',
      value: true,
      deps: [],
    },
  },
];

const restore = (v: unknown): unknown =>
  v === NEG_ZERO
    ? -0
    : Array.isArray(v)
      ? v.map(restore)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, restore(x)]))
        : v;

function generate(): string {
  const cases = CASES.map(({ name, op: written }) => {
    const op = restore(written);
    // The wire form exactly as the server stores it: decoding and encoding changes nothing.
    const wire = encodeOp(decodeOp(op));
    expect(canonicalJson(wire)).toBe(canonicalJson(op));
    return { name, op: written, canonical: canonicalJson(wire), hash: opHash(wire) };
  });
  return JSON.stringify({ version: 1, cases }, null, 2).replaceAll(`"${NEG_ZERO}"`, '-0') + '\n';
}

describe('op_hash golden vectors', () => {
  it('vectors/op-hash/op-hash.json is what this server computes', () => {
    const text = generate();
    if (process.env.ACCORD_WRITE_VECTORS) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
    expect(readFileSync(file, 'utf8')).toBe(text);
  });

  it('every case, read back from the file, hashes as written', () => {
    const v = JSON.parse(readFileSync(file, 'utf8')) as {
      version: number;
      cases: { name: string; op: unknown; canonical: string; hash: string }[];
    };
    expect(v.version).toBe(1);
    expect(v.cases.length).toBe(CASES.length);
    for (const c of v.cases) {
      const wire = encodeOp(decodeOp(c.op));
      expect(canonicalJson(wire), c.name).toBe(c.canonical);
      expect(opHash(wire), c.name).toBe(c.hash);
    }
    const negZero = v.cases.find((c) => c.name.startsWith('-0'))!;
    expect(Object.is((negZero.op as { value: unknown }).value, -0)).toBe(true);
  });
});
