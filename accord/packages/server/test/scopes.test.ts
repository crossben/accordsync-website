import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { def, type Harness, startHarness, TestDevice, token } from './harness';

describe('read scopes changing without a full resync', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  }, 120_000);
  afterAll(async () => h?.stop());
  beforeEach(async () => h.reset());

  /** Bob owns a Thiès dossier with some history; Alice owns a Dakar one. */
  const seed = async () => {
    const bob = new TestDevice(h, 'bob-phone', await token('bob', { zones: ['thies'] }));
    await bob.push([
      bob.writer.assign('dossier:7', 'agent', 'bob'),
      bob.writer.assign('dossier:7', 'zone', 'thies'),
      bob.writer.inc('dossier:7', 'visits', 3),
    ]);
    const alice = new TestDevice(h, 'alice-phone', await token('alice', { zones: ['dakar'] }));
    await alice.push([
      alice.writer.assign('dossier:1', 'agent', 'alice'),
      alice.writer.assign('dossier:1', 'zone', 'dakar'),
    ]);
    await alice.pullAll();
    expect(alice.writer.replica.records()).toEqual(['dossier:1']);
    return { alice, bob };
  };

  it('a widened scope brings the new records with their history, no resync', async () => {
    const { alice } = await seed();
    alice.jwt = await token('alice', { zones: ['dakar', 'thies'] });
    await alice.pullAll(); // would throw on resync_required
    expect(alice.writer.replica.records()).toEqual(['dossier:1', 'dossier:7']);
    expect(alice.writer.replica.read('dossier:7')).toMatchObject({ agent: 'bob', visits: 3 });
  });

  it('a narrowed scope sends exits only for records no longer visible at all', async () => {
    const { alice, bob } = await seed();
    alice.jwt = await token('alice', { zones: ['dakar', 'thies'] });
    await alice.pullAll();
    await bob.push([bob.writer.inc('dossier:7', 'visits', 1)]);

    alice.jwt = await token('alice', { zones: [] }); // she keeps her own dossier (agent key)
    const items = await alice.pullAll();
    expect(items.filter((i) => i.type === 'exit')).toEqual([{ type: 'exit', record: 'dossier:7' }]);
    // dossier:1 is still hers through her agent key: no exit, still on the device.
    expect(alice.writer.replica.records()).toContain('dossier:1');
  });

  it('falls back to a resync when the change is too big', async () => {
    const { alice } = await seed();
    const app = createApp({
      db: h.db,
      def: { ...def, limits: { ...def.limits, maxScopeDelta: 0 } },
    });
    const res = await app.request(`/v1/pull?cursor=${alice.cursor}`, {
      headers: {
        Authorization: `Bearer ${await token('alice', { zones: ['dakar', 'thies'] })}`,
        'Accord-Device': 'alice-phone',
      },
    });
    expect(await res.json()).toEqual({ resync_required: true });
  });
});
