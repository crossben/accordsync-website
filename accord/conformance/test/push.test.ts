import { beforeEach, describe, expect, it } from 'vitest';
import { control, Device, opIds, profile, type WireOp } from './accord';

/** An assign op with its `value` key removed. */
const withoutValue = (op: WireOp): Record<string, unknown> =>
  Object.fromEntries(Object.entries(op).filter(([k]) => k !== 'value'));

describe('push (docs/protocol.md "Push", ADR-0006, ADR-0010)', () => {
  let alice: Device;
  let reader: Device;
  beforeEach(async () => {
    await control.reset();
    alice = await Device.of('alice-phone', 'alice', { zones: ['dakar'] });
    reader = new Device('alice-tablet', alice.jwt);
  });

  it('acknowledges accepted ops, in write order for one record', async () => {
    const ops = [
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits', 2),
      alice.add('dossier:1', 'docs', 'cni.pdf'),
      alice.assign('dossier:1', 'status', 'draft'),
    ];
    expect(await alice.pushOk(ops)).toEqual({
      acked: ['alice-phone:1', 'alice-phone:2', 'alice-phone:3', 'alice-phone:4'],
      refused: [],
    });
  });

  it('an empty push is answered { acked: [], refused: [] }', async () => {
    expect(await alice.pushOk([])).toEqual({ acked: [], refused: [] });
  });

  it('a retried push (same ops) is acknowledged again and stored once (docs/protocol.md: resending is always safe)', async () => {
    const ops = [alice.assign('dossier:1', 'agent', 'alice'), alice.inc('dossier:1', 'visits')];
    await alice.pushOk(ops);
    expect(await alice.pushOk(ops)).toEqual({ acked: [ops[0]!.op_id, ops[1]!.op_id], refused: [] });
    // A retry mixed with new ops: old ones acked, new one applied.
    const more = alice.inc('dossier:1', 'visits');
    expect((await alice.pushOk([...ops, more])).acked).toEqual([
      ops[0]!.op_id,
      ops[1]!.op_id,
      more.op_id,
    ]);
    expect(opIds(await reader.pullAll())).toEqual([ops[0]!.op_id, ops[1]!.op_id, more.op_id]);
  });

  it('the same op id with different content is refused "op id already used", never acked (ADR-0010)', async () => {
    const first = alice.assign('dossier:1', 'agent', 'alice');
    await alice.pushOk([first]);
    const reused = { ...alice.inc('dossier:1', 'visits', 5), op_id: first.op_id };
    const { acked, refused } = await alice.pushOk([reused]);
    expect(acked).toEqual([]);
    expect(refused).toHaveLength(1);
    expect(refused[0]!.op_id).toBe(first.op_id);
    expect(refused[0]!.reason).toMatch(/^op id already used/);
    expect(opIds(await reader.pullAll())).toEqual([first.op_id]);
  });

  it('a new op numbered at or below device_seq is refused "op id already used" (a device that lost its storage)', async () => {
    await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits'),
      alice.inc('dossier:1', 'visits'),
    ]);
    // Reinstalled with the same device id, counting from 1 again, writing another record.
    const amnesiac = new Device('alice-phone', alice.jwt);
    const op = amnesiac.assign('dossier:2', 'agent', 'alice');
    const { acked, refused } = await amnesiac.pushOk([op]);
    expect(acked).toEqual([]);
    expect(refused).toEqual([{ op_id: 'alice-phone:1', reason: expect.any(String) }]);
    expect(refused[0]!.reason).toMatch(/^op id already used/);
    // It learns device_seq from a pull and numbers above it.
    const page = await amnesiac.page(0);
    expect(page.device_seq).toBe(3);
    amnesiac.seq = page.device_seq!;
    expect((await amnesiac.pushOk([amnesiac.assign('dossier:2', 'agent', 'alice')])).acked).toEqual(
      ['alice-phone:4'],
    );
  });

  it('refuses a malformed op that has an op_id, with a "malformed op" reason; the rest of the batch applies', async () => {
    const good = alice.assign('dossier:1', 'agent', 'alice');
    const bad = [
      { ...alice.inc('dossier:1', 'visits'), kind: 'explode' },
      { ...alice.inc('dossier:1', 'visits'), by: 1.5 },
      { ...alice.inc('dossier:1', 'visits'), hlc: 'yesterday' },
      { ...alice.add('dossier:1', 'docs', 'x'), element: { nested: true } },
      { ...alice.assign('dossier:1', 'status', 'x'), record: 'no-colon' },
      withoutValue(alice.assign('dossier:1', 'status', 'x')),
    ];
    const { acked, refused } = await alice.pushOk([good, ...bad]);
    expect(acked).toEqual([good.op_id]);
    expect(refused.map((r) => r.op_id)).toEqual(bad.map((b) => b.op_id));
    for (const r of refused) expect(r.reason).toMatch(/^malformed op/);
  });

  it('refuses an op carrying a lone surrogate as malformed; the rest of the batch applies (no 500)', async () => {
    const first = alice.assign('dossier:1', 'agent', 'alice');
    const value = alice.assign('dossier:1', 'client_name', 'aXb');
    const element = alice.add('dossier:1', 'docs', 'cXd');
    const record = alice.inc('dossier:eXf', 'visits');
    const last = alice.inc('dossier:1', 'visits');
    // JSON carries a lone surrogate as an escape; JSON.stringify would write it the same way, but
    // the body is spelled out so the test does not depend on it.
    const body = `{"ops":[${[first, value, element, record, last]
      .map((op) => JSON.stringify(op).replace(/([ace])X([bdf])/, '$1\\ud800$2'))
      .join(',')}]}`;
    expect(body).toContain('"a\\ud800b"');
    expect(body).toContain('"c\\ud800d"');
    const r = await alice.pushBody(body);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.acked).toEqual([first.op_id, last.op_id]);
    expect(r.body.refused.map((x) => x.op_id)).toEqual([value.op_id, element.op_id, record.op_id]);
    for (const x of r.body.refused) expect(x.reason).toMatch(/^malformed op/);
    expect(opIds(await reader.pullAll())).toEqual([first.op_id, last.op_id]);
  });

  it('rejects the whole push with 400 when an op has no readable op_id', async () => {
    const good = alice.assign('dossier:1', 'agent', 'alice');
    for (const op of [{ nonsense: true }, null, 'op', { ...good, op_id: 42 }]) {
      const r = await alice.push([good, op]);
      expect(r.status, JSON.stringify(op)).toBe(400);
    }
    // Nothing from the rejected pushes was applied.
    expect(await reader.pullAll()).toEqual([]);
  });

  it('refuses an op stamped by another device: "op belongs to device <id>"', async () => {
    const other = new Device('other', alice.jwt);
    const forged = other.assign('dossier:1', 'agent', 'alice');
    expect(await alice.pushOk([forged])).toEqual({
      acked: [],
      refused: [{ op_id: 'other:1', reason: 'op belongs to device other' }],
    });
  });

  it('refuses an op whose clock names another device than its op id, as malformed', async () => {
    const op = { ...alice.assign('dossier:1', 'agent', 'alice'), hlc: `${Date.now()}:00000:bob` };
    const { refused } = await alice.pushOk([op]);
    expect(refused).toHaveLength(1);
    expect(refused[0]!.op_id).toBe(op.op_id);
    expect(refused[0]!.reason).toMatch(/^malformed op/);
  });

  it('refuses an unknown record type or field (does not fit the schema)', async () => {
    const { acked, refused } = await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.assign('invoice:1', 'agent', 'alice'),
      alice.assign('dossier:1', 'color', 'red'),
    ]);
    expect(acked).toEqual(['alice-phone:1']);
    expect(refused).toEqual([
      { op_id: 'alice-phone:3', reason: expect.stringMatching(/unknown field/) },
      { op_id: 'alice-phone:2', reason: expect.stringMatching(/unknown record type/) },
    ]);
  });

  it('refuses an op kind that does not fit the field strategy', async () => {
    await alice.pushOk([alice.assign('dossier:1', 'agent', 'alice')]);
    const wrong = [
      alice.inc('dossier:1', 'agent'), // lww
      alice.assign('dossier:1', 'visits', 3), // counter
      alice.inc('dossier:1', 'docs'), // set
      alice.add('dossier:1', 'status', 'x'), // conflict
    ];
    const { acked, refused } = await alice.pushOk(wrong);
    expect(acked).toEqual([]);
    expect(refused.map((r) => r.op_id)).toEqual(wrong.map((o) => o.op_id));
    for (const r of refused) expect(r.reason).toMatch(/does not apply/);
  });

  it('refuses an op whose clock is further ahead than maxSkewMs', async () => {
    const op = {
      ...alice.assign('dossier:1', 'agent', 'alice'),
      hlc: alice.hlc(profile.limits.maxSkewMs + 60_000),
    };
    const { acked, refused } = await alice.pushOk([op]);
    expect(acked).toEqual([]);
    expect(refused).toEqual([
      { op_id: op.op_id, reason: expect.stringMatching(/ahead of the server/) },
    ]);
  });

  it('a refused op leaves no trace: the record can still be created afterwards', async () => {
    const refusedOp = alice.assign('dossier:1', 'agent', 'bob'); // out of scope for alice
    expect((await alice.pushOk([refusedOp])).refused).toHaveLength(1);
    expect(await reader.pullAll()).toEqual([]);
    const ok = alice.assign('dossier:1', 'agent', 'alice');
    expect((await alice.pushOk([ok])).acked).toEqual([ok.op_id]);
  });

  it(`400 for more than maxPushOps (${profile.limits.maxPushOps}) ops; exactly the limit is accepted`, async () => {
    const make = (n: number) => [
      alice.assign('dossier:1', 'agent', 'alice'),
      ...Array.from({ length: n - 1 }, () => alice.inc('dossier:1', 'visits')),
    ];
    const tooMany = await alice.push(make(profile.limits.maxPushOps + 1));
    expect(tooMany.status).toBe(400);
    alice.seq = 0;
    const ok = await alice.pushOk(make(profile.limits.maxPushOps));
    expect(ok.acked).toHaveLength(profile.limits.maxPushOps);
  });

  it('device_seq is the highest op number applied from this device (refused ops do not count)', async () => {
    expect((await alice.page(0)).device_seq).toBe(0);
    await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits'),
    ]);
    expect((await alice.page(0)).device_seq).toBe(2);
    await alice.pushOk([alice.assign('dossier:2', 'agent', 'bob')]); // refused, number 3
    expect((await alice.page(0)).device_seq).toBe(2);
    // Another device of the same user has its own sequence.
    expect((await reader.page(0)).device_seq).toBe(0);
  });
});
