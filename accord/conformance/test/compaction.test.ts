import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertSchema,
  control,
  Device,
  opIds,
  type PullItem,
  type Snapshot,
  types,
} from './accord';

/** Compaction folds history into record snapshots (ADR-0005, ADR-0008), run via POST /compact. */
describe('compaction and snapshots', () => {
  let alice: Device;
  beforeEach(async () => {
    await control.reset();
    alice = await Device.of('alice-phone', 'alice', { zones: ['dakar'] });
  });

  /** Eleven ops on one dossier; Alice pulls everything and reports her cursor. */
  const history = async () => {
    const add = alice.add('dossier:1', 'docs', 'a.pdf');
    const draft = alice.assign('dossier:1', 'status', 'draft');
    const ops = [
      alice.assign('dossier:1', 'agent', 'alice'),
      ...Array.from({ length: 5 }, () => alice.inc('dossier:1', 'visits')),
      add,
      alice.remove('dossier:1', 'docs', 'a.pdf', [add.op_id]),
      alice.add('dossier:1', 'docs', 'b.pdf'),
      draft,
      alice.assign('dossier:1', 'status', 'submitted', [draft.op_id]),
    ];
    expect((await alice.pushOk(ops)).acked).toHaveLength(11);
    await alice.pullAll();
    await alice.pullAll(); // reports her cursor: compaction waits for live devices
    return ops;
  };

  const snapshotOf = (items: PullItem[]): Snapshot => {
    const s = items.find((i) => i.type === 'snapshot');
    if (!s || s.type !== 'snapshot') throw new Error('no snapshot item');
    return s.snapshot;
  };

  it('a new device receives one snapshot item instead of the folded ops', async () => {
    await history();
    expect(await control.compact()).toMatchObject({ records: 1, opsFolded: 11 });
    const tablet = new Device('alice-tablet', alice.jwt);
    const items = await tablet.pullAll();
    expect(types(items)).toEqual(['snapshot']);
    const snap = snapshotOf(items);
    assertSchema('PullItem', items[0]);
    expect(snap.record).toBe('dossier:1');
    expect(Object.keys(snap.fields).sort()).toEqual(['agent', 'docs', 'status', 'visits']);
    // Two new devices receive the same snapshot.
    expect(await new Device('alice-laptop', alice.jwt).pullAll()).toEqual(items);
  });

  it('live devices are not sent the snapshot (they are past it)', async () => {
    await history();
    await control.compact();
    expect(await alice.pullAll()).toEqual([]);
  });

  it('later ops arrive after the snapshot', async () => {
    await history();
    await control.compact();
    const later = [alice.inc('dossier:1', 'visits', 2), alice.add('dossier:1', 'docs', 'c.pdf')];
    await alice.pushOk(later);
    const items = await new Device('alice-tablet', alice.jwt).pullAll();
    expect(types(items)).toEqual(['snapshot', 'op', 'op']);
    expect(opIds(items)).toEqual(later.map((o) => o.op_id));
  });

  it('a retried push of compacted ops is acknowledged, not applied again', async () => {
    const ops = await history();
    await control.compact();
    const before = await new Device('alice-tablet', alice.jwt).pullAll();
    expect(await alice.pushOk(ops)).toEqual({ acked: ops.map((o) => o.op_id), refused: [] });
    // Nothing new in the feed: live device sees nothing, a new device sees the same snapshot.
    expect(await alice.pullAll()).toEqual([]);
    expect(await new Device('alice-laptop', alice.jwt).pullAll()).toEqual(before);
  });

  it('device_seq survives compaction', async () => {
    await history();
    await control.compact();
    expect((await alice.page(0)).device_seq).toBe(11);
    expect((await new Device('alice-tablet', alice.jwt).page(0)).device_seq).toBe(0);
  });

  it('an op id below device_seq that is not a compacted op is still refused after compaction', async () => {
    await history();
    await alice.pushOk([alice.assign('dossier:2', 'agent', 'alice')]); // 12, not folded (1 op)
    await alice.pullAll();
    await alice.pullAll();
    await control.compact();
    const amnesiac = new Device('alice-phone', alice.jwt);
    amnesiac.seq = 11; // reuses number 12 for other content
    const reused = amnesiac.inc('dossier:2', 'visits');
    const { acked, refused } = await amnesiac.pushOk([reused]);
    expect(acked).toEqual([]);
    expect(refused[0]?.reason).toMatch(/^op id already used/);
  });

  // Folded ops are remembered by a hash of their content (compacted_ops.op_hash, migration 0006),
  // so a *different* op reusing a compacted id (a device that lost its storage and pushes before its
  // first pull) is refused, never acknowledged as a retry and silently dropped.
  it('a different op reusing a compacted op id is refused, not silently acked (ADR-0010)', async () => {
    await history();
    await control.compact();
    const amnesiac = new Device('alice-phone', alice.jwt);
    const reused = amnesiac.assign('dossier:2', 'agent', 'alice'); // alice-phone:1, other content
    const { acked, refused } = await amnesiac.pushOk([reused]);
    expect(acked).toEqual([]);
    expect(refused[0]?.reason).toMatch(/^op id already used/);
  });

  it('waits for a live device that has not pulled yet', async () => {
    await history();
    await new Device('alice-laptop', alice.jwt).pull(0, 1); // registered, cursor 0
    expect(await control.compact()).toMatchObject({ records: 0, opsFolded: 0 });
  });

  it('a device past the TTL no longer holds compaction back, and must resync', async () => {
    await history();
    const old = new Device('alice-old', alice.jwt);
    await old.pull(0, 1);
    await control.ageDevice('alice-old', 31);
    expect(await control.compact()).toMatchObject({ records: 1 });
    expect(await old.pull(1)).toEqual({ resync_required: true });
    expect(types(await old.pullAll())).toEqual(['snapshot']);
  });

  it('a record entering a scope after compaction arrives as its snapshot, then the op that moved it', async () => {
    await history();
    await control.compact();
    const bob = await Device.of('bob-phone', 'bob');
    expect(await bob.pullAll()).toEqual([]);
    const move = alice.assign('dossier:1', 'agent', 'bob');
    await alice.pushOk([move]);
    const items = await bob.pullAll();
    expect(types(items)).toEqual(['snapshot', 'op']);
    expect(items[1]).toEqual({ type: 'op', op: move });
  });

  it('records with fewer than minOps ops are not compacted', async () => {
    await alice.pushOk([alice.assign('dossier:1', 'agent', 'alice')]);
    await alice.pullAll();
    await alice.pullAll();
    expect(await control.compact()).toMatchObject({ records: 0 });
    expect(types(await new Device('alice-tablet', alice.jwt).pullAll())).toEqual(['op']);
  });
});
