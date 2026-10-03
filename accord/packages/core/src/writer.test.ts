import { describe, expect, it } from 'vitest';
import { conflict, counter, defineSchema, lww, set } from './schema';
import { LocalWriter } from './writer';

const schema = defineSchema({
  dossier: { client_name: lww(), documents: set(), visits: counter(), status: conflict() },
});

const device = (id: string, start = 1_000) => {
  let now = start;
  return new LocalWriter({ schema, deviceId: id, now: () => now++ });
};

describe('LocalWriter', () => {
  it('numbers ops per device and stamps increasing clocks', () => {
    const a = device('a');
    const o1 = a.assign('dossier:1', 'client_name', 'Awa');
    const o2 = a.assign('dossier:1', 'client_name', 'Awa Diop');
    expect([o1.opId, o2.opId]).toEqual(['a:1', 'a:2']);
    expect(a.replica.read('dossier:1')).toMatchObject({ client_name: 'Awa Diop' });
  });

  it('reads defaults for untouched fields', () => {
    const a = device('a');
    a.inc('dossier:1', 'visits', 2);
    expect(a.replica.read('dossier:1')).toEqual({
      client_name: undefined,
      documents: [],
      visits: 2,
      status: undefined,
    });
    expect(a.replica.read('dossier:404')).toBeUndefined();
  });

  it('rejects writes that do not match the schema', () => {
    const a = device('a');
    expect(() => a.assign('dossier:1', 'nope', 1)).toThrow(/unknown field/);
    expect(() => a.assign('ghost:1', 'x', 1)).toThrow(/unknown record type/);
    expect(() => a.inc('dossier:1', 'client_name', 1)).toThrow(/lww/);
    expect(() => a.inc('dossier:1', 'visits', 0.5)).toThrow(/integer/);
    expect(() => a.add('dossier:1', 'documents', { a: 1 } as never)).toThrow(/string or number/);
  });

  it('sets: remove only removes what the writer has seen (add wins)', () => {
    const a = device('a');
    const b = device('b');
    const add = a.add('dossier:1', 'documents', 'cni.pdf');
    b.receive(add);
    const remove = b.remove('dossier:1', 'documents', 'cni.pdf');
    const readd = a.add('dossier:1', 'documents', 'cni.pdf'); // concurrent with the remove
    a.receive(remove);
    b.receive(readd);
    expect(a.replica.read('dossier:1')?.documents).toEqual(['cni.pdf']);
    expect(b.replica.read('dossier:1')?.documents).toEqual(['cni.pdf']);
  });

  it('conflict(): concurrent assigns surface both values; nothing is guessed', () => {
    const a = device('a');
    const b = device('b');
    const x = a.assign('dossier:1', 'status', 'approved');
    const y = b.assign('dossier:1', 'status', 'rejected');
    a.receive(y);
    b.receive(x);
    for (const r of [a.replica, b.replica]) {
      expect(r.read('dossier:1')?.status).toEqual({
        conflicted: [
          { value: 'approved', opId: 'a:1' },
          { value: 'rejected', opId: 'b:1' },
        ],
      });
      expect(r.conflicts()).toEqual([{ record: 'dossier:1', field: 'status' }]);
    }
  });

  it('conflict(): a sequential edit replaces the value it saw, without a conflict', () => {
    const a = device('a');
    const b = device('b');
    b.receive(a.assign('dossier:1', 'status', 'draft'));
    a.receive(b.assign('dossier:1', 'status', 'submitted'));
    expect(a.replica.read('dossier:1')?.status).toEqual({ value: 'submitted' });
    expect(a.replica.conflicts()).toEqual([]);
  });

  it('conflict(): resolving keeps an edit the resolver had not seen', () => {
    const a = device('a');
    const b = device('b');
    const c = device('c');
    const x = a.assign('dossier:1', 'status', 'approved');
    const y = b.assign('dossier:1', 'status', 'rejected');
    const z = c.assign('dossier:1', 'status', 'on_hold'); // c is offline the whole time
    a.receive(y);
    const resolution = a.assign('dossier:1', 'status', 'approved'); // resolves x and y
    expect(resolution.kind === 'assign' && resolution.deps).toEqual(['a:1', 'b:1']);
    for (const op of [resolution, z, x]) b.receive(op);
    expect(b.replica.read('dossier:1')?.status).toEqual({
      conflicted: [
        { value: 'approved', opId: 'a:2' },
        { value: 'on_hold', opId: 'c:1' },
      ],
    });
  });

  it('counts every increment, including negative ones', () => {
    const a = device('a');
    const b = device('b');
    const ops = [a.inc('dossier:1', 'visits', 3), b.inc('dossier:1', 'visits', -1)];
    a.receive(ops[1]!);
    b.receive(ops[0]!);
    expect(a.replica.read('dossier:1')?.visits).toBe(2);
    expect(b.replica.read('dossier:1')?.visits).toBe(2);
  });

  it('ignores a duplicate op', () => {
    const a = device('a');
    const b = device('b');
    const op = a.inc('dossier:1', 'visits', 5);
    expect(b.receive(op)).toBe('applied');
    expect(b.receive(op)).toBe('duplicate');
    expect(b.replica.read('dossier:1')?.visits).toBe(5);
  });

  it('lww: highest clock wins regardless of arrival order', () => {
    const a = device('a', 1_000);
    const b = device('b', 5_000); // b's clock is ahead
    const x = b.assign('dossier:1', 'client_name', 'from b');
    const y = a.assign('dossier:1', 'client_name', 'from a');
    a.receive(x);
    b.receive(y);
    expect(a.replica.read('dossier:1')?.client_name).toBe('from b');
    expect(b.replica.read('dossier:1')?.client_name).toBe('from b');
  });

  it('refuses an op from a clock too far ahead and leaves state untouched', () => {
    const a = new LocalWriter({ schema, deviceId: 'a', now: () => 1_000, maxSkewMs: 60_000 });
    const liar = new LocalWriter({ schema, deviceId: 'liar', now: () => 10_000_000 });
    expect(() => a.receive(liar.inc('dossier:1', 'visits', 1))).toThrow(/ahead/);
    expect(a.replica.read('dossier:1')).toBeUndefined();
  });

  it('discard rolls back a refused op and keeps the rest', () => {
    const a = device('a');
    const keep = a.inc('dossier:1', 'visits', 2);
    const refused = a.inc('dossier:1', 'visits', 40);
    a.assign('dossier:2', 'status', 'approved');
    a.discard([refused.opId]);
    expect(a.replica.read('dossier:1')?.visits).toBe(2);
    expect(a.replica.has(keep.opId)).toBe(true);
    expect(a.replica.has(refused.opId)).toBe(false);
    expect(a.replica.read('dossier:2')?.status).toEqual({ value: 'approved' });
    expect(a.inc('dossier:1', 'visits', 1).opId).toBe('a:4'); // op ids are never reused
  });

  it('never reuses an op id after receiving its own old ops (fresh storage, same device id)', () => {
    const before = device('a');
    const old = [before.inc('dossier:1', 'visits', 1), before.inc('dossier:1', 'visits', 2)];
    const reinstalled = device('a'); // same device id, empty storage: counter starts at 0
    for (const op of old) reinstalled.receive(op);
    const next = reinstalled.inc('dossier:1', 'visits', 4);
    expect(next.opId).toBe('a:3');
    expect(reinstalled.replica.read('dossier:1')?.visits).toBe(7);
  });

  it('sets: re-adding a present element replaces the tags its writer saw (state stays small)', () => {
    const a = device('a');
    const b = device('b');
    for (let i = 0; i < 50; i++) a.add('dossier:1', 'documents', 'cni.pdf');
    const tags = (r: typeof a) => r.replica.observedDeps('dossier:1', 'documents', 'cni.pdf');
    expect(tags(a)).toHaveLength(1);
    // Still add-wins: a remove concurrent with a re-add loses.
    for (const op of a.replica.ops()) b.receive(op);
    const remove = b.remove('dossier:1', 'documents', 'cni.pdf');
    const readd = a.add('dossier:1', 'documents', 'cni.pdf');
    a.receive(remove);
    b.receive(readd);
    expect(a.replica.read('dossier:1')?.documents).toEqual(['cni.pdf']);
    expect(b.replica.read('dossier:1')?.documents).toEqual(['cni.pdf']);
  });
});
