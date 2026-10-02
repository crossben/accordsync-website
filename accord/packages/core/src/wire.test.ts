import { describe, expect, it } from 'vitest';
import { decodeOp, encodeOp } from './wire';
import type { Op } from './op';

const op: Op = {
  opId: 'dev-7f3a:1042',
  record: 'dossier:91',
  field: 'status',
  hlc: { wall: 1727871000123, counter: 4, node: 'dev-7f3a' },
  kind: 'assign',
  value: 'submitted',
  deps: ['dev-7f3a:1041'],
};

describe('wire format', () => {
  it('round-trips an op', () => {
    expect(decodeOp(JSON.parse(JSON.stringify(encodeOp(op))))).toEqual(op);
  });

  it('matches the documented shape', () => {
    expect(encodeOp(op)).toEqual({
      op_id: 'dev-7f3a:1042',
      record: 'dossier:91',
      field: 'status',
      kind: 'assign',
      value: 'submitted',
      hlc: '1727871000123:00004:dev-7f3a',
      deps: ['dev-7f3a:1041'],
    });
  });

  it('rejects malformed ops with a reason', () => {
    const good = encodeOp(op);
    const bad: unknown[] = [
      null,
      { ...good, op_id: 'no-seq' },
      { ...good, op_id: 'other:1' }, // op id device must match the clock's node
      { ...good, record: 'no-type' },
      { ...good, kind: 'explode' },
      { ...good, kind: 'inc', by: 1.5 },
      { ...good, kind: 'add', element: [] },
      { ...good, deps: 'a:1' },
      { ...good, hlc: 'garbage' },
    ];
    for (const b of bad) expect(() => decodeOp(b), JSON.stringify(b)).toThrow();
  });
});
