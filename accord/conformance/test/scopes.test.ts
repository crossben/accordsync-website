import { beforeEach, describe, expect, it } from 'vitest';
import { control, Device, opIds } from './accord';

/**
 * docs/protocol.md: "An existing record accepts a write if its current scope keys overlap the
 * caller's write keys. A new record accepts it if the keys it would have after the write overlap
 * them." ADR-0004 (exits), ADR-0007 (feed and scopes). Refusal text is exact: clients show it.
 */
describe('write scopes', () => {
  let alice: Device;
  let bob: Device;
  beforeEach(async () => {
    await control.reset();
    alice = await Device.of('alice-phone', 'alice', { zones: ['dakar'] });
    bob = await Device.of('bob-phone', 'bob', { zones: ['thies'] });
  });

  it('a new record is checked against the keys it has after the write', async () => {
    expect(await alice.pushOk([alice.assign('dossier:1', 'agent', 'alice')])).toEqual({
      acked: ['alice-phone:1'],
      refused: [],
    });
    // Through a zone she can write.
    expect((await alice.pushOk([alice.assign('dossier:2', 'zone', 'dakar')])).acked).toEqual([
      'alice-phone:2',
    ]);
    // Into someone else's scope: refused with the exact reason.
    expect(await alice.pushOk([alice.assign('dossier:3', 'agent', 'bob')])).toEqual({
      acked: [],
      refused: [{ op_id: 'alice-phone:3', reason: 'out of scope: you may not write dossier:3' }],
    });
    // A first write that gives the record no key at all is out of everyone's scope.
    expect(await alice.pushOk([alice.inc('dossier:4', 'visits')])).toEqual({
      acked: [],
      refused: [{ op_id: 'alice-phone:4', reason: 'out of scope: you may not write dossier:4' }],
    });
  });

  it('within one push, each op is checked against the record as the previous ops left it', async () => {
    // A keyless op first is refused; the assign that creates the record in her scope is accepted;
    // the next op then sees an existing record she may write.
    const ops = [
      alice.inc('dossier:1', 'visits'),
      alice.assign('dossier:1', 'agent', 'alice'),
      alice.inc('dossier:1', 'visits'),
      alice.assign('dossier:1', 'agent', 'bob'), // allowed: she may write it where it is now
      alice.inc('dossier:1', 'visits'), // refused: it is bob's now
    ];
    const { acked, refused } = await alice.pushOk(ops);
    expect(acked).toEqual([ops[1]!.op_id, ops[2]!.op_id, ops[3]!.op_id]);
    expect(refused).toEqual([
      { op_id: ops[0]!.op_id, reason: 'out of scope: you may not write dossier:1' },
      { op_id: ops[4]!.op_id, reason: 'out of scope: you may not write dossier:1' },
    ]);
  });

  it("an existing record is checked against its current keys: someone else's record is refused", async () => {
    await bob.pushOk([bob.assign('dossier:9', 'agent', 'bob')]);
    const sneaky = alice.assign('dossier:9', 'status', 'approved');
    expect(await alice.pushOk([sneaky])).toEqual({
      acked: [],
      refused: [{ op_id: sneaky.op_id, reason: 'out of scope: you may not write dossier:9' }],
    });
    // Even a write that would move it into her scope: the current keys decide.
    const grab = alice.assign('dossier:9', 'agent', 'alice');
    expect((await alice.pushOk([grab])).refused).toEqual([
      { op_id: grab.op_id, reason: 'out of scope: you may not write dossier:9' },
    ]);
  });

  it('after a record is reassigned away, its former owner can no longer write it (ADR-0004)', async () => {
    await alice.pushOk([alice.assign('dossier:1', 'agent', 'alice')]);
    expect((await alice.pushOk([alice.assign('dossier:1', 'agent', 'bob')])).acked).toHaveLength(1);
    const late = alice.inc('dossier:1', 'visits');
    expect((await alice.pushOk([late])).refused).toEqual([
      { op_id: late.op_id, reason: 'out of scope: you may not write dossier:1' },
    ]);
    // Bob can.
    expect((await bob.pushOk([bob.inc('dossier:1', 'visits')])).acked).toHaveLength(1);
  });

  it('a zone writer may write any record of the zone', async () => {
    await bob.pushOk([
      bob.assign('dossier:5', 'agent', 'bob'),
      bob.assign('dossier:5', 'zone', 'dakar'),
    ]);
    const op = alice.inc('dossier:5', 'visits');
    expect((await alice.pushOk([op])).acked).toEqual([op.op_id]);
  });

  it('read-only access: a readonly_zones member reads the zone but cannot write it', async () => {
    await bob.pushOk([
      bob.assign('dossier:7', 'agent', 'bob'),
      bob.assign('dossier:7', 'zone', 'thies'),
    ]);
    const carol = await Device.of('carol-phone', 'carol', { readonly_zones: ['thies'] });
    const items = await carol.pullAll();
    expect(opIds(items)).toEqual(['bob-phone:1', 'bob-phone:2']);

    const write = carol.inc('dossier:7', 'visits');
    expect(await carol.pushOk([write])).toEqual({
      acked: [],
      refused: [{ op_id: write.op_id, reason: 'out of scope: you may not write dossier:7' }],
    });
    const create = carol.assign('dossier:8', 'zone', 'thies');
    expect((await carol.pushOk([create])).refused).toEqual([
      { op_id: create.op_id, reason: 'out of scope: you may not write dossier:8' },
    ]);
    // Her own agent key stays writable.
    expect((await carol.pushOk([carol.assign('dossier:9', 'agent', 'carol')])).acked).toHaveLength(
      1,
    );
  });
});
