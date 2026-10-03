import { encodeOp, LocalWriter, parseOpId } from '@accordsync/core';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadRecord } from '../src/sync';
import { def, type Harness, schema, startHarness, TestDevice, token } from './harness';

describe('sync over HTTP, against real PostgreSQL', () => {
  let h: Harness;
  let alice: TestDevice;
  let bob: TestDevice;

  beforeAll(async () => {
    h = await startHarness();
  }, 120_000);
  afterAll(async () => h?.stop());
  beforeEach(async () => {
    await h.reset();
    alice = new TestDevice(h, 'alice-phone', await token('alice', { zones: ['dakar'] }));
    bob = new TestDevice(h, 'bob-phone', await token('bob', { zones: ['thies'] }));
  });

  const ops = (d: TestDevice) => d.writer.replica.ops();

  it('pushes, then pulls the same ops back; a second pull is empty', async () => {
    const w = alice.writer;
    w.assign('dossier:1', 'agent', 'alice');
    w.inc('dossier:1', 'visits', 2);
    w.add('dossier:1', 'docs', 'cni.pdf');
    const { status, body } = await alice.push(ops(alice));
    expect(status).toBe(200);
    expect(body).toEqual({
      acked: ['alice-phone:1', 'alice-phone:2', 'alice-phone:3'],
      refused: [],
    });

    const other = new TestDevice(h, 'alice-tablet', alice.jwt);
    await other.pullAll();
    expect(other.writer.replica.snapshot()).toBe(alice.writer.replica.snapshot());
    expect(await other.pullAll()).toEqual([]);
  });

  it('a retried push is acknowledged again and stored once', async () => {
    alice.writer.assign('dossier:1', 'agent', 'alice');
    alice.writer.inc('dossier:1', 'visits', 1);
    await alice.push(ops(alice));
    const again = await alice.push(ops(alice));
    expect(again.body.acked).toHaveLength(2);
    const { n } = await h.db
      .selectFrom('feed')
      .select(sql<string>`count(*)`.as('n'))
      .where('kind', '=', 'op')
      .executeTakeFirstOrThrow();
    expect(Number(n)).toBe(2);
  });

  it('pages through a long backlog and resumes from its cursor', async () => {
    alice.writer.assign('dossier:1', 'agent', 'alice');
    for (let i = 0; i < 24; i++) alice.writer.inc('dossier:1', 'visits', 1);
    await alice.push(ops(alice));

    const reader = new TestDevice(h, 'alice-tablet', alice.jwt);
    const first = await reader.pull(10);
    if ('resync_required' in first) throw new Error('unexpected');
    expect(first.has_more).toBe(true);
    reader.cursor = first.cursor; // dies here, after page 1 …
    const rest = await reader.pullAll(10); // … and resumes from page 2
    const ids = [...first.items, ...rest].map((i) =>
      i.type === 'op' ? i.op.op_id : i.type === 'exit' ? i.record : i.snapshot.record,
    );
    expect(new Set(ids).size).toBe(25); // every op exactly once across pages
    expect(ids).toHaveLength(25);
  });

  it("refuses writes to someone else's record, with a reason", async () => {
    bob.writer.assign('dossier:9', 'agent', 'bob');
    await bob.push(ops(bob));
    alice.writer.receive(ops(bob)[0]!);
    const sneaky = alice.writer.assign('dossier:9', 'status', 'approved');
    const { body } = await alice.push([sneaky]);
    expect(body.acked).toEqual([]);
    expect(body.refused).toEqual([
      { op_id: sneaky.opId, reason: 'out of scope: you may not write dossier:9' },
    ]);
  });

  it('refuses creating a record in a scope the writer cannot write', async () => {
    const op = alice.writer.assign('dossier:2', 'agent', 'bob');
    const { body } = await alice.push([op]);
    expect(body.refused.map((r) => r.op_id)).toEqual([op.opId]);
  });

  it('a record entering your scope arrives with its whole history', async () => {
    alice.writer.assign('dossier:1', 'agent', 'alice');
    alice.writer.inc('dossier:1', 'visits', 3);
    alice.writer.assign('dossier:1', 'status', 'draft');
    await alice.push(ops(alice));
    expect(await bob.pullAll()).toEqual([]); // not bob's yet

    const reassign = alice.writer.assign('dossier:1', 'agent', 'bob');
    expect((await alice.push([reassign])).body.acked).toEqual([reassign.opId]);
    const items = await bob.pullAll();
    expect(items.filter((i) => i.type === 'op')).toHaveLength(4);
    expect(bob.writer.replica.read('dossier:1')).toMatchObject({
      agent: 'bob',
      visits: 3,
      status: { value: 'draft' },
    });
  });

  it('a record leaving your scope sends an exit marker, and later writes are refused', async () => {
    alice.writer.assign('dossier:1', 'agent', 'alice');
    await alice.push(ops(alice));
    await alice.pullAll();

    await alice.push([alice.writer.assign('dossier:1', 'agent', 'bob')]);
    const items = await alice.pullAll();
    expect(items).toContainEqual({ type: 'exit', record: 'dossier:1' });

    const late = alice.writer.inc('dossier:1', 'visits', 1);
    expect((await alice.push([late])).body.refused[0]?.reason).toMatch(/out of scope/);
  });

  it('zone members read records of their zone', async () => {
    alice.writer.assign('dossier:5', 'agent', 'alice');
    alice.writer.assign('dossier:5', 'zone', 'thies');
    await alice.push(ops(alice));
    await bob.pullAll();
    expect(bob.writer.replica.read('dossier:5')).toMatchObject({ agent: 'alice', zone: 'thies' });
  });

  it('serves a changed-scope pull without a resync, and a fresh pull from zero', async () => {
    alice.writer.assign('dossier:1', 'agent', 'alice');
    await alice.push(ops(alice));
    await alice.pullAll();
    alice.jwt = await token('alice', { zones: ['dakar', 'thies'] });
    // A small change of scopes is sent as a delta, not a resync (see scopes.test.ts).
    expect('items' in (await alice.pull())).toBe(true);
    const fresh = await alice.pull(500, 0);
    expect('items' in fresh && fresh.items.length).toBe(1);
  });

  it('refuses a device id that belongs to another user', async () => {
    await alice.pullAll();
    const thief = new TestDevice(h, 'alice-phone', bob.jwt);
    const res = await h.app.request('/v1/pull', {
      headers: { Authorization: `Bearer ${thief.jwt}`, 'Accord-Device': 'alice-phone' },
    });
    expect(res.status).toBe(403);
  });

  it('refuses ops stamped by another device', async () => {
    const forged = new LocalWriter({ schema, deviceId: 'other', now: Date.now }).assign(
      'dossier:1',
      'agent',
      'alice',
    );
    const { body } = await alice.push([forged]);
    expect(body.refused).toEqual([{ op_id: 'other:1', reason: 'op belongs to device other' }]);
  });

  it('rejects requests without a valid token or device header', async () => {
    expect((await h.app.request('/v1/pull')).status).toBe(401);
    const bad = await h.app.request('/v1/pull', {
      headers: { Authorization: 'Bearer nope', 'Accord-Device': 'x' },
    });
    expect(bad.status).toBe(401);
    const noDevice = await h.app.request('/v1/pull', {
      headers: { Authorization: `Bearer ${alice.jwt}` },
    });
    expect(noDevice.status).toBe(400);
  });

  it('refuses ops from a clock far in the future', async () => {
    const liar = new LocalWriter({
      schema,
      deviceId: 'alice-phone',
      now: () => Date.now() + 3 * 24 * 3_600_000,
    });
    const { body } = await alice.push([liar.assign('dossier:1', 'agent', 'alice')]);
    expect(body.refused[0]?.reason).toMatch(/ahead of the server/);
  });

  it('refuses malformed ops individually, and rejects an unreadable batch', async () => {
    const good = encodeOp(alice.writer.assign('dossier:1', 'agent', 'alice'));
    const { body } = await alice.push([
      good,
      { ...good, op_id: 'alice-phone:99', kind: 'explode' },
    ]);
    expect(body.acked).toEqual([good.op_id]);
    expect(body.refused[0]?.op_id).toBe('alice-phone:99');
    expect((await alice.push([{ nonsense: true }])).status).toBe(400);
    expect((await alice.push(Array.from({ length: 101 }, () => good))).status).toBe(400);
  });

  it('the feed is append-only: Postgres refuses edits', async () => {
    alice.writer.assign('dossier:1', 'agent', 'alice');
    await alice.push(ops(alice));
    await expect(sql`update feed set record = 'x'`.execute(h.db)).rejects.toThrow(/append-only/);
    await expect(sql`delete from feed`.execute(h.db)).rejects.toThrow(/append-only/);
  });

  it('concurrent pushes and paged pulls never skip an op', async () => {
    const writers = await Promise.all(
      Array.from(
        { length: 8 },
        async (_, i) => new TestDevice(h, `w${i}`, await token(`u${i}`, { zones: ['all'] })),
      ),
    );
    const reader = new TestDevice(h, 'reader', await token('reader', { zones: ['all'] }));
    for (const [i, w] of writers.entries()) {
      w.writer.assign(`dossier:${i}`, 'agent', `u${i}`);
      w.writer.assign(`dossier:${i}`, 'zone', 'all');
      for (let k = 0; k < 20; k++) w.writer.inc(`dossier:${i}`, 'visits', 1);
    }
    // Writers push in small concurrent batches while the reader keeps pulling small pages.
    let done = false;
    const pushing = Promise.all(
      writers.map(async (w) => {
        // In write order, as a real client pushes its outbox (ops() sorts ids as strings).
        const all = w.writer.replica
          .ops()
          .sort((a, b) => parseOpId(a.opId).seq - parseOpId(b.opId).seq);
        for (let k = 0; k < all.length; k += 3) await w.push(all.slice(k, k + 3));
      }),
    ).then(() => (done = true));
    while (!done) await reader.pullAll(4);
    await pushing;
    await reader.pullAll(4);

    const expected = new LocalWriter({ schema, deviceId: 'check', now: Date.now });
    for (const w of writers) for (const op of w.writer.replica.ops()) expected.receive(op);
    expect(reader.writer.replica.size).toBe(8 * 22);
    expect(reader.writer.replica.snapshot()).toBe(expected.replica.snapshot());
  }, 60_000);

  it('the stored record state always equals a rebuild from the feed', async () => {
    const devices = await Promise.all(
      ['a', 'b', 'c'].map(async (n) => new TestDevice(h, `${n}-dev`, await token('alice'))),
    );
    await devices[0]!.push([devices[0]!.writer.assign('dossier:1', 'agent', 'alice')]);
    for (let round = 0; round < 6; round++) {
      for (const [i, d] of devices.entries()) {
        await d.pullAll();
        const w = d.writer;
        const ops = [
          w.inc('dossier:1', 'visits', i + 1),
          w.add('dossier:1', 'docs', `doc-${(round + i) % 3}`),
          w.assign('dossier:1', 'status', `s${(round * 3 + i) % 4}`),
          ...(round % 2 ? [w.remove('dossier:1', 'docs', `doc-${round % 3}`)] : []),
        ];
        await d.push(ops);
      }
    }
    const stored = await h.db
      .selectFrom('records')
      .select('state')
      .where('record', '=', 'dossier:1')
      .executeTakeFirstOrThrow();
    const fromState = new (await import('@accordsync/core')).Replica(schema);
    fromState.loadSnapshot(stored.state!);
    const rebuilt = await loadRecord(h.db, def, 'dossier:1');
    expect(fromState.read('dossier:1')).toEqual(rebuilt.read('dossier:1'));
    expect(rebuilt.read('dossier:1')?.visits).toBe(36);
  });
});
