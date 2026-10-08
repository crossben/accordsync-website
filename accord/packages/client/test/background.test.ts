import type { WireOp } from '@accordsync/core';
import { describe, expect, it } from 'vitest';
import { AccordClient } from '../src/client';
import { conflict, counter, defineSchema, lww, set } from '../src/index';
import { MemoryStorage } from '../src/storage/memory';
import type { Transport } from '../src/transport';

const schema = defineSchema({
  dossier: { zone: lww(), visits: counter(), docs: set(), status: conflict() },
});

/** Acks every op; pulls are empty. */
function fakeTransport(): Transport & { pushed: WireOp[] } {
  const pushed: WireOp[] = [];
  return {
    pushed,
    push: async (_device, ops) => {
      pushed.push(...ops);
      return { acked: ops.map((o) => o.op_id), refused: [] };
    },
    pull: async (_device, cursor) => ({ items: [], cursor, has_more: false }),
  };
}

describe('background sync', () => {
  it('a write made during a round is synced soon after it, not after syncIntervalMs', async () => {
    const transport = fakeTransport();
    const awa = await AccordClient.open({
      schema,
      storage: new MemoryStorage(),
      deviceId: 'awa-bg',
      transport,
      syncIntervalMs: 60_000,
    });
    let wrote = false;
    const pushed = new Promise<void>((resolve) =>
      awa.on('synced', () => {
        // Inside the first round: the next one must not wait for syncIntervalMs.
        if (!wrote) {
          wrote = true;
          void awa.assign('dossier:1', 'zone', 'dakar');
        } else if (awa.status().pending === 0) resolve();
      }),
    );
    awa.start();
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 2000));
    const result = await Promise.race([pushed.then(() => 'pushed' as const), timeout]);
    awa.stop();
    expect(result).toBe('pushed');
    expect(transport.pushed.map((o) => o.record)).toEqual(['dossier:1']);
  });

  it('the same when the write lands while a manual sync() is still pulling', async () => {
    const transport = fakeTransport();
    let release: () => void = () => {};
    let pulling: () => void = () => {};
    const inPull = new Promise<void>((r) => (pulling = r));
    let hold = false;
    const pull = transport.pull;
    transport.pull = async (device, cursor, limit) => {
      if (hold) {
        hold = false;
        pulling();
        await new Promise<void>((r) => (release = r));
      }
      return pull(device, cursor, limit);
    };
    const awa = await AccordClient.open({
      schema,
      storage: new MemoryStorage(),
      deviceId: 'awa-bg',
      transport,
      syncIntervalMs: 60_000,
    });
    awa.start();
    await new Promise((r) => setTimeout(r, 20)); // the first background round is over
    hold = true;
    const round = awa.sync();
    await inPull;
    await awa.assign('dossier:1', 'zone', 'dakar'); // saved while the round is in flight
    release();
    await round;
    const pushed = new Promise<void>((resolve) =>
      awa.on('synced', () => {
        if (awa.status().pending === 0) resolve();
      }),
    );
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 2000));
    const result = await Promise.race([pushed.then(() => 'pushed' as const), timeout]);
    awa.stop();
    expect(result).toBe('pushed');
  });
});
