import { encodeOp, type Op } from '@accordsync/core';
import { sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { compact } from '../src/compact';
import { def, type Harness, startHarness, TestDevice, token } from './harness';

describe('concurrent pushes (ADR-0010) against real PostgreSQL', () => {
  let h: Harness;
  let url: string;

  beforeAll(async () => {
    h = await startHarness();
    url = h.url;
  }, 120_000);
  afterAll(async () => h?.stop());
  beforeEach(async () => {
    await h.reset();
    await sql`truncate compacted_ops`.execute(h.db);
  });

  it('a pull never moves past a transaction that is still writing', async () => {
    const alice = new TestDevice(h, 'alice-phone', await token('alice'));
    const reader = new TestDevice(h, 'alice-tablet', alice.jwt);
    await alice.push([alice.writer.assign('dossier:1', 'agent', 'alice')]);
    await reader.pullAll();

    // A slow writer: its transaction takes a position, writes, and does not commit yet.
    const slowOp = alice.writer.inc('dossier:1', 'visits', 5);
    const slow = new pg.Client({ connectionString: url });
    await slow.connect();
    await slow.query('begin');
    await slow.query(
      `insert into feed (kind, record, op_id, op, scopes) values ('op', 'dossier:1', $1, $2, '{agent:alice}')`,
      [slowOp.opId, JSON.stringify(encodeOp(slowOp))],
    );

    // A fast push commits after it, with a later position.
    await alice.push([alice.writer.inc('dossier:1', 'visits', 1)]);
    const meanwhile = await reader.pullAll();
    expect(meanwhile).toEqual([]); // the fast op waits: the slow transaction is still below it

    await slow.query('commit');
    await slow.end();
    const after = await reader.pullAll();
    expect(after.map((i) => i.type === 'op' && i.op.op_id)).toEqual([slowOp.opId, 'alice-phone:3']);
    expect(reader.writer.replica.read('dossier:1')?.visits).toBe(6);
  });

  it('many devices pushing at once to shared and own records: nothing lost, nothing doubled', async () => {
    const devices = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => new TestDevice(h, `d${i}`, await token('team'))),
    );
    await devices[0]!.push([devices[0]!.writer.assign('dossier:shared', 'agent', 'team')]);
    for (const d of devices) await d.pullAll();
    const reader = new TestDevice(h, 'reader', await token('team'));
    let done = false;
    const pushing = Promise.all(
      devices.map(async (d, i) => {
        for (let round = 0; round < 8; round++) {
          const ops: Op[] = [
            d.writer.inc('dossier:shared', 'visits', 1),
            d.writer.inc(`dossier:own${i}`, 'visits', 1),
          ];
          if (round === 0) ops.unshift(d.writer.assign(`dossier:own${i}`, 'agent', 'team'));
          const { body } = await d.push(ops);
          expect(body.refused).toEqual([]);
          if (round === 3) await d.push(ops); // a retry, racing with the others
        }
      }),
    ).then(() => (done = true));
    while (!done) await reader.pullAll(7);
    await pushing;
    await reader.pullAll(7);
    expect(reader.writer.replica.read('dossier:shared')?.visits).toBe(12 * 8);
    for (let i = 0; i < 12; i++)
      expect(reader.writer.replica.read(`dossier:own${i}`)?.visits).toBe(8);
  });

  it('forgets compacted-op entries once their device has pushed past them', async () => {
    const alice = new TestDevice(h, 'alice-phone', await token('alice'));
    const w = alice.writer;
    await alice.push([w.assign('dossier:1', 'agent', 'alice'), w.inc('dossier:1', 'visits', 1)]);
    await alice.pullAll();
    await alice.pull(500);
    const first = await compact(h.db, def);
    expect(first.opsFolded).toBe(2);
    const count = async () =>
      Number(
        (await sql<{ n: string }>`select count(*) as n from compacted_ops`.execute(h.db)).rows[0]!
          .n,
      );
    expect(await count()).toBe(2);
    // A retry of a folded op is still recognised...
    expect((await alice.push(w.replica.ops())).body.acked).toHaveLength(2);
    // ...until the device pushes newer ops: it can no longer resend the old ones.
    await alice.push([w.inc('dossier:1', 'visits', 1)]);
    expect((await compact(h.db, def)).tombstonesPruned).toBe(2);
    expect(await count()).toBe(0);
  });

  it('answers 429 with Retry-After when a device exceeds its rate limit', async () => {
    const app = createApp({
      db: h.db,
      def: { ...def, rateLimit: { perDevice: { perMinute: 60, burst: 2 } } },
    });
    const headers = { Authorization: `Bearer ${await token('alice')}`, 'Accord-Device': 'busy' };
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await app.request('/v1/pull', { headers })).status);
    expect(statuses).toEqual([200, 200, 429]);
    const res = await app.request('/v1/pull', { headers });
    expect(res.headers.get('Retry-After')).toBe('1');
  });
});
