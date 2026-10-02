import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { compact } from '../src/compact';
import { def, type Harness, startHarness, TestDevice, token } from './harness';

describe('log compaction against real PostgreSQL', () => {
  let h: Harness;
  let alice: TestDevice;

  beforeAll(async () => {
    h = await startHarness();
  }, 120_000);
  afterAll(async () => h?.stop());
  beforeEach(async () => {
    await h.reset();
    await sql`truncate compacted_ops`.execute(h.db);
    alice = new TestDevice(h, 'alice-phone', await token('alice', { zones: ['dakar'] }));
  });

  const feedRows = async () =>
    (await sql<{ kind: string }>`select kind from feed order by seq`.execute(h.db)).rows.map(
      (r) => r.kind,
    );

  /** Alice writes a dossier with history, and pulls everything (so she holds compaction back no more). */
  const history = async () => {
    const w = alice.writer;
    w.assign('dossier:1', 'agent', 'alice');
    for (let i = 0; i < 5; i++) w.inc('dossier:1', 'visits', 1);
    w.add('dossier:1', 'docs', 'a.pdf');
    w.remove('dossier:1', 'docs', 'a.pdf');
    w.add('dossier:1', 'docs', 'b.pdf');
    w.assign('dossier:1', 'status', 'draft');
    w.assign('dossier:1', 'status', 'submitted');
    await alice.push(w.replica.ops());
    await alice.pullAll();
    await alice.pull(500); // reports her cursor to the server
  };

  it('folds a record everyone has into one snapshot; a new device gets the same state', async () => {
    await history();
    const result = await compact(h.db, def);
    expect(result).toMatchObject({ records: 1, opsFolded: 11 });
    expect((await feedRows()).filter((k) => k !== 'scope')).toEqual(['snapshot']);

    const tablet = new TestDevice(h, 'alice-tablet', alice.jwt);
    const items = await tablet.pullAll();
    expect(items.map((i) => i.type)).toEqual(['snapshot']);
    expect(tablet.writer.replica.snapshot()).toBe(alice.writer.replica.snapshot());
  });

  it('waits for live devices that have not pulled yet', async () => {
    await history();
    const laggard = new TestDevice(h, 'alice-laptop', alice.jwt);
    await laggard.pull(1); // registered, but behind
    expect(await compact(h.db, def)).toMatchObject({ records: 0 });
  });

  it('ignores devices retired past the TTL, and makes them resync when they return', async () => {
    await history();
    const old = new TestDevice(h, 'alice-old', alice.jwt);
    await old.pull(1);
    await sql`update devices set last_seen = now() - interval '31 days' where device_id = 'alice-old'`.execute(
      h.db,
    );
    expect(await compact(h.db, def)).toMatchObject({ records: 1 });

    old.cursor = 1;
    expect(await old.pull()).toEqual({ resync_required: true });
    const fresh = await old.pull(500, 0);
    expect('items' in fresh && fresh.items.map((i) => i.type)).toEqual(['snapshot']);
  });

  it('acknowledges a retried push of a compacted op without applying it twice', async () => {
    await history();
    await compact(h.db, def);
    const before = alice.writer.replica.ops();
    const { body } = await alice.push(before);
    expect(body.acked).toHaveLength(before.length);
    const tablet = new TestDevice(h, 'alice-tablet', alice.jwt);
    await tablet.pullAll();
    expect(tablet.writer.replica.read('dossier:1')?.visits).toBe(5);
  });

  it('keeps merging after compaction: later ops land on top of the snapshot', async () => {
    await history();
    await compact(h.db, def);
    await alice.push([
      alice.writer.inc('dossier:1', 'visits', 2),
      alice.writer.add('dossier:1', 'docs', 'c.pdf'),
      alice.writer.remove('dossier:1', 'docs', 'b.pdf'),
    ]);
    const tablet = new TestDevice(h, 'alice-tablet', alice.jwt);
    await tablet.pullAll();
    expect(tablet.writer.replica.read('dossier:1')).toMatchObject({
      visits: 7,
      docs: ['c.pdf'],
      status: { value: 'submitted' },
    });
  });

  it('a record entering a scope after compaction arrives as its snapshot plus later ops', async () => {
    await history();
    await compact(h.db, def);
    const bob = new TestDevice(h, 'bob-phone', await token('bob', { zones: [] }));
    await bob.pullAll();
    await alice.push([alice.writer.assign('dossier:1', 'agent', 'bob')]);
    const items = await bob.pullAll();
    expect(items.map((i) => i.type)).toEqual(['snapshot', 'op']);
    expect(bob.writer.replica.read('dossier:1')).toMatchObject({ agent: 'bob', visits: 5 });
  });
});
