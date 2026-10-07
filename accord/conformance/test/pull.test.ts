import { beforeEach, describe, expect, it } from 'vitest';
import { control, Device, opIds, type PullItem, profile, types, type WireOp } from './accord';

describe('pull (docs/protocol.md "Pull", ADR-0007)', () => {
  let alice: Device;
  let bob: Device;
  beforeEach(async () => {
    await control.reset();
    alice = await Device.of('alice-phone', 'alice', { zones: ['dakar'] });
    bob = await Device.of('bob-phone', 'bob', { zones: ['thies'] });
  });

  /** `n` ops, each in its own push (its own transaction, so pages can split between them). */
  const separatePushes = async (d: Device, record: string, n: number): Promise<string[]> => {
    const ids = [];
    for (let i = 0; i < n; i++) {
      const op = i === 0 ? d.assign(record, 'agent', 'alice') : d.inc(record, 'visits');
      expect((await d.pushOk([op])).acked).toEqual([op.op_id]);
      ids.push(op.op_id);
    }
    return ids;
  };

  it('an empty feed: no items, has_more false, a cursor, device_seq 0', async () => {
    const page = await alice.page(0);
    expect(page).toEqual({ items: [], cursor: expect.any(Number), has_more: false, device_seq: 0 });
    // Pulling again from the returned cursor is still empty.
    expect((await alice.page(page.cursor)).items).toEqual([]);
  });

  it('op items are the pushed wire ops, unchanged (deps omitted on a first add; kept otherwise)', async () => {
    const ops: WireOp[] = [
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.assign('dossier:1', 'client_name', { first: 'Awa', tags: [1, 2.5, null, true] }),
      alice.inc('dossier:1', 'visits', -3),
      alice.add('dossier:1', 'docs', 'cni.pdf'),
      alice.add('dossier:1', 'docs', 7),
      alice.assign('dossier:1', 'status', 'draft'),
    ];
    ops.push(alice.remove('dossier:1', 'docs', 'cni.pdf', [ops[3]!.op_id]));
    ops.push(alice.add('dossier:1', 'docs', 'cni.pdf', [ops[6]!.op_id]));
    ops.push(alice.assign('dossier:1', 'status', 'submitted', [ops[5]!.op_id]));
    expect((await alice.pushOk(ops)).acked).toHaveLength(ops.length);

    const tablet = new Device('alice-tablet', alice.jwt);
    const items = await tablet.pullAll();
    expect(items).toEqual(ops.map((op) => ({ type: 'op', op })));
    // The first add has no "deps" key at all.
    const firstAdd = items[3] as { op: Record<string, unknown> };
    expect('deps' in firstAdd.op).toBe(false);
  });

  it('items arrive in the order the server accepted them, across pushes and devices', async () => {
    const tablet = new Device('alice-tablet', alice.jwt);
    const a = alice.assign('dossier:1', 'agent', 'alice');
    await alice.pushOk([a]);
    const b = tablet.inc('dossier:1', 'visits');
    await tablet.pushOk([b]);
    const c = alice.assign('dossier:2', 'agent', 'alice');
    const d = alice.inc('dossier:1', 'visits');
    await alice.pushOk([c, d]);
    const reader = new Device('alice-laptop', alice.jwt);
    const ids = opIds(await reader.pullAll());
    expect(ids.slice(0, 2)).toEqual([a.op_id, b.op_id]);
    expect(new Set(ids.slice(2))).toEqual(new Set([c.op_id, d.op_id]));
  });

  it('pages with limit: has_more until the end, every op exactly once, cursor never goes back', async () => {
    const ids = await separatePushes(alice, 'dossier:1', 9);
    const reader = new Device('alice-tablet', alice.jwt);
    const seen: PullItem[] = [];
    let pages = 0;
    for (;;) {
      const page = await reader.page(reader.cursor, 3);
      expect(page.items.length).toBeLessThanOrEqual(3);
      expect(page.cursor).toBeGreaterThanOrEqual(reader.cursor);
      seen.push(...page.items);
      reader.cursor = page.cursor;
      pages++;
      if (!page.has_more) break;
      expect(page.items.length).toBeGreaterThan(0);
    }
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(opIds(seen)).toEqual(ids);
    // Nothing more.
    expect(await reader.page(reader.cursor, 3)).toMatchObject({ items: [], has_more: false });
  });

  it('a device that stopped after a page resumes from its stored cursor; replaying a page is the same page', async () => {
    const ids = await separatePushes(alice, 'dossier:1', 7);
    const reader = new Device('alice-tablet', alice.jwt);
    const first = await reader.page(0, 3);
    expect(first.has_more).toBe(true);
    const again = await reader.page(0, 3);
    expect(again.items).toEqual(first.items);
    reader.cursor = first.cursor;
    const rest = await reader.pullAll(3);
    expect(opIds([...first.items, ...rest])).toEqual(ids);
  });

  it(`clamps the page size to maxPullLimit (${profile.limits.maxPullLimit})`, async () => {
    const ids = await separatePushes(alice, 'dossier:1', profile.limits.maxPullLimit + 5);
    const reader = new Device('alice-tablet', alice.jwt);
    const first = await reader.page(0, 1000);
    expect(first.items.length).toBeLessThanOrEqual(profile.limits.maxPullLimit);
    expect(first.has_more).toBe(true);
    reader.cursor = first.cursor;
    expect(opIds([...first.items, ...(await reader.pullAll(1000))])).toEqual(ids);
  });

  it('a page never splits one push: a transaction bigger than the limit is sent whole', async () => {
    const ops = [
      alice.assign('dossier:1', 'agent', 'alice'),
      ...Array.from({ length: 5 }, () => alice.inc('dossier:1', 'visits')),
    ];
    await alice.pushOk(ops);
    const reader = new Device('alice-tablet', alice.jwt);
    const items = await reader.pullAll(2);
    expect(opIds(items)).toEqual(ops.map((o) => o.op_id));
  });

  it("device_seq on every page is this device's highest applied op number", async () => {
    await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits'),
    ]);
    await alice.pushOk([alice.inc('dossier:1', 'visits')]);
    expect((await alice.page(0)).device_seq).toBe(3);
    await alice.pullAll();
    expect(alice.deviceSeq).toBe(3);
  });

  it('a record entering your scope arrives with its whole history, in order, in the same page', async () => {
    const history = [
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits', 3),
      alice.assign('dossier:1', 'status', 'draft'),
    ];
    await alice.pushOk(history);
    expect(await bob.pullAll()).toEqual([]); // not his yet

    const reassign = alice.assign('dossier:1', 'agent', 'bob', [history[0]!.op_id]);
    expect((await alice.pushOk([reassign])).acked).toEqual([reassign.op_id]);
    const page = await bob.page(bob.cursor);
    expect(opIds(page.items)).toEqual([...history, reassign].map((o) => o.op_id));
    expect(types(page.items)).toEqual(['op', 'op', 'op', 'op']);
  });

  it('a record leaving your scope (reassigned) sends one exit item, and nothing else about it (ADR-0004)', async () => {
    await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits'),
    ]);
    await alice.pushOk([alice.assign('dossier:2', 'agent', 'alice')]);
    await alice.pullAll();

    await alice.pushOk([alice.assign('dossier:1', 'agent', 'bob')]);
    expect(await alice.pullAll()).toEqual([{ type: 'exit', record: 'dossier:1' }]);
    // A later write to it by its new owner is not sent to her.
    await bob.pushOk([bob.inc('dossier:1', 'visits')]);
    expect(await alice.pullAll()).toEqual([]);
    // A fresh device of hers may receive its old ops (they were visible to her then), but the
    // last item about it is the exit, so it ends without the record.
    const tablet = new Device('alice-tablet', alice.jwt);
    const about1 = (await tablet.pullAll()).filter(
      (i) => (i.type === 'op' ? i.op.record : i.type === 'exit' ? i.record : '') === 'dossier:1',
    );
    expect(about1.at(-1)).toEqual({ type: 'exit', record: 'dossier:1' });
    expect(opIds(about1)).not.toContain('bob-phone:1');
  });

  it('no exit while the record stays visible through another key', async () => {
    await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.assign('dossier:1', 'zone', 'dakar'),
    ]);
    await alice.pullAll();
    const move = alice.assign('dossier:1', 'agent', 'bob');
    await alice.pushOk([move]);
    // Still in zone dakar, which she reads: she gets the op, not an exit.
    expect(await alice.pullAll()).toEqual([{ type: 'op', op: move }]);
  });

  it('zone readers receive the records of their zone', async () => {
    await alice.pushOk([
      alice.assign('dossier:5', 'agent', 'alice'),
      alice.assign('dossier:5', 'zone', 'thies'),
    ]);
    expect(opIds(await bob.pullAll())).toEqual(['alice-phone:1', 'alice-phone:2']);
  });
});

describe('scope changes from new claims (ADR-0011) and retired devices (ADR-0005)', () => {
  beforeEach(async () => {
    await control.reset();
  });

  /** Bob owns `n` Thiès dossiers with history; Alice owns a Dakar one and is up to date. */
  const seed = async (n = 1) => {
    const bob = await Device.of('bob-phone', 'bob', { zones: ['thies'] });
    for (let i = 0; i < n; i++) {
      await bob.pushOk([
        bob.assign(`dossier:t${i}`, 'agent', 'bob'),
        bob.assign(`dossier:t${i}`, 'zone', 'thies'),
        bob.inc(`dossier:t${i}`, 'visits', 3),
      ]);
    }
    const alice = await Device.of('alice-phone', 'alice', { zones: ['dakar'] });
    await alice.pushOk([
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.assign('dossier:1', 'zone', 'dakar'),
    ]);
    expect(opIds(await alice.pullAll())).toEqual(['alice-phone:1', 'alice-phone:2']);
    return { alice, bob };
  };

  it('a widened scope brings the entering records with their whole history, without a resync', async () => {
    const { alice } = await seed(2);
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    const items = await alice.pullAll(); // throws on resync_required
    expect(new Set(opIds(items))).toEqual(
      new Set([
        'bob-phone:1',
        'bob-phone:2',
        'bob-phone:3',
        'bob-phone:4',
        'bob-phone:5',
        'bob-phone:6',
      ]),
    );
    // Each record's history is in order.
    const t0 = opIds(items).filter((id) =>
      ['bob-phone:1', 'bob-phone:2', 'bob-phone:3'].includes(id),
    );
    expect(t0).toEqual(['bob-phone:1', 'bob-phone:2', 'bob-phone:3']);
  });

  it('a narrowed scope sends exits only for records no longer visible through any key', async () => {
    const { alice, bob } = await seed(1);
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    await alice.pullAll();
    await bob.pushOk([bob.inc('dossier:t0', 'visits')]);

    alice.jwt = await control.token('alice', { zones: [] }); // keeps dossier:1 through agent:alice
    const items = await alice.pullAll();
    expect(items.filter((i) => i.type === 'exit')).toEqual([
      { type: 'exit', record: 'dossier:t0' },
    ]);
    expect(items.some((i) => i.type === 'op' && i.op.record === 'dossier:t0')).toBe(false);
  });

  it('a scope delta whose answer was lost is sent again by the retry at the same cursor', async () => {
    const { alice, bob } = await seed(1);
    const history = ['bob-phone:1', 'bob-phone:2', 'bob-phone:3'];
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    // The answer carrying the delta is lost: the device keeps its cursor.
    expect(opIds((await alice.page(alice.cursor)).items)).toEqual(history);
    const retry = await alice.page(alice.cursor);
    expect(opIds(retry.items)).toEqual(history);
    alice.cursor = retry.cursor;
    // Received: the next pull, from the new cursor, does not send it again.
    await bob.pushOk([bob.inc('dossier:t0', 'visits')]);
    expect(opIds(await alice.pullAll())).toEqual(['bob-phone:4']);
    expect(await alice.pullAll()).toEqual([]);
  });

  it('an exit whose answer was lost is sent again by the retry at the same cursor', async () => {
    const { alice, bob } = await seed(1);
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    await alice.pullAll();
    alice.jwt = await control.token('alice', { zones: ['dakar'] });
    const exit = [{ type: 'exit', record: 'dossier:t0' }];
    expect((await alice.page(alice.cursor)).items).toEqual(exit); // lost
    const retry = await alice.page(alice.cursor);
    expect(retry.items).toEqual(exit);
    alice.cursor = retry.cursor;
    await bob.pushOk([bob.inc('dossier:t0', 'visits')]);
    await alice.pushOk([alice.inc('dossier:1', 'visits')]);
    expect(await alice.pullAll()).toEqual([
      { type: 'op', op: expect.objectContaining({ op_id: 'alice-phone:3' }) },
    ]);
  });

  it('claims that change again before a lost delta is received: the retry sends the whole change', async () => {
    const { alice } = await seed(1);
    const carol = await Device.of('carol-phone', 'carol', { zones: ['kaolack'] });
    await carol.pushOk([
      carol.assign('dossier:k', 'agent', 'carol'),
      carol.assign('dossier:k', 'zone', 'kaolack'),
    ]);
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    await alice.page(alice.cursor); // lost
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies', 'kaolack'] });
    expect(new Set(opIds(await alice.pullAll()))).toEqual(
      new Set(['bob-phone:1', 'bob-phone:2', 'bob-phone:3', 'carol-phone:1', 'carol-phone:2']),
    );
    expect(await alice.pullAll()).toEqual([]);
  });

  it('read-only zones count as read scope: gaining one brings its records', async () => {
    const { alice } = await seed(1);
    alice.jwt = await control.token('alice', { zones: ['dakar'], readonly_zones: ['thies'] });
    expect(new Set(opIds(await alice.pullAll()))).toEqual(
      new Set(['bob-phone:1', 'bob-phone:2', 'bob-phone:3']),
    );
  });

  it(`answers exactly { resync_required: true } when more than maxScopeDelta (${profile.limits.maxScopeDelta}) records change`, async () => {
    const { alice } = await seed(profile.limits.maxScopeDelta + 1);
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    const r = await alice.pullRaw(alice.cursor);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ resync_required: true });
    // It keeps answering so until the device pulls from 0, which then sends everything.
    expect(await alice.pull(alice.cursor)).toEqual({ resync_required: true });
    alice.cursor = 0;
    const all = await alice.pullAll();
    expect(opIds(all)).toHaveLength(2 + 3 * (profile.limits.maxScopeDelta + 1));
    // Then incremental pulls work again.
    expect(await alice.pullAll()).toEqual([]);
  });

  it('exactly maxScopeDelta changed records is still a delta', async () => {
    const { alice } = await seed(profile.limits.maxScopeDelta);
    alice.jwt = await control.token('alice', { zones: ['dakar', 'thies'] });
    expect(opIds(await alice.pullAll())).toHaveLength(3 * profile.limits.maxScopeDelta);
  });

  it(`a device unseen longer than deviceTtlDays (${profile.compaction.deviceTtlDays}) must resync; from cursor 0 it gets everything`, async () => {
    const { alice } = await seed(1);
    await control.ageDevice('alice-phone', profile.compaction.deviceTtlDays + 1);
    expect(await alice.pull(alice.cursor)).toEqual({ resync_required: true });
    alice.cursor = 0;
    expect(opIds(await alice.pullAll())).toEqual(['alice-phone:1', 'alice-phone:2']);
    expect(await alice.pullAll()).toEqual([]);
  });

  it('a device seen within the TTL does not resync', async () => {
    const { alice } = await seed(1);
    await control.ageDevice('alice-phone', profile.compaction.deviceTtlDays - 1);
    expect(await alice.pullAll()).toEqual([]);
  });
});
