import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import type { WireOp } from '@accordsync/core';
import { describe, expect, it } from 'vitest';
import type { StorageAdapter, StoredMeta } from '../src/storage/adapter';
import { IndexedDbStorage } from '../src/storage/indexeddb';
import { MemoryStorage } from '../src/storage/memory';
import { SqliteStorage } from '../src/storage/sqlite';
import { nodeSqlite } from './sqlite-driver';

const op = (n: number): WireOp => ({
  op_id: `d:${n}`,
  record: 'dossier:1',
  field: 'visits',
  kind: 'inc',
  by: n,
  hlc: `${1000 + n}:00000:d`,
});
const meta = (cursor: number): StoredMeta => ({
  deviceId: 'd',
  cursor,
  hlc: '1000:00000:d',
  seq: 3,
});

/** Each factory returns a fresh store, plus a way to reopen the same data (a restart). */
const adapters: Record<string, () => { store: StorageAdapter; reopen?: () => StorageAdapter }> = {
  memory: () => ({ store: new MemoryStorage() }),
  sqlite: () => {
    const file = join(mkdtempSync(join(tmpdir(), 'accord-')), 'a.db');
    return {
      store: new SqliteStorage(nodeSqlite(file)),
      reopen: () => new SqliteStorage(nodeSqlite(file)),
    };
  },
  indexeddb: () => {
    const factory = new IDBFactory();
    return {
      store: new IndexedDbStorage('accord', factory),
      reopen: () => new IndexedDbStorage('accord', factory),
    };
  },
};

for (const [name, make] of Object.entries(adapters)) {
  describe(`${name} storage`, () => {
    it('starts empty', async () => {
      expect(await make().store.load()).toEqual({
        meta: undefined,
        snapshots: [],
        ops: [],
        outbox: [],
      });
    });

    it('commits ops, outbox and meta, and applies deletes, clears and outbox removals', async () => {
      const { store } = make();
      await store.commit({
        putOps: [op(1), op(2), op(3)],
        outboxAdd: ['d:1', 'd:2'],
        meta: meta(5),
      });
      await store.commit({ deleteOps: ['d:3'], outboxDelete: ['d:1'], meta: meta(7) });
      const s = await store.load();
      expect(s.ops.map((o) => o.op_id).sort()).toEqual(['d:1', 'd:2']);
      expect(s.outbox).toEqual(['d:2']);
      expect(s.meta).toEqual(meta(7));

      await store.commit({ clearOps: true, putOps: [op(9)] });
      expect((await store.load()).ops).toEqual([op(9)]);
    });

    it('stores snapshots, replaced by record, cleared with the ops', async () => {
      const { store } = make();
      const snap = (n: number) => ({
        record: 'dossier:1',
        fields: { visits: { strategy: 'counter' as const, total: n } },
      });
      await store.commit({ putSnapshots: [snap(1)] });
      await store.commit({ putSnapshots: [snap(2)] });
      expect((await store.load()).snapshots).toEqual([snap(2)]);
      await store.commit({ deleteSnapshots: ['dossier:1'] });
      expect((await store.load()).snapshots).toEqual([]);
      await store.commit({ putSnapshots: [snap(3)], putOps: [op(1)] });
      await store.commit({ clearOps: true });
      expect(await store.load()).toMatchObject({ snapshots: [], ops: [] });
    });

    it('returns copies, not live references', async () => {
      const { store } = make();
      const o = op(1);
      await store.commit({ putOps: [o] });
      (o as { by: number }).by = 99;
      expect((await store.load()).ops[0]).toEqual(op(1));
    });

    if (make().reopen) {
      it('survives a restart', async () => {
        const { store, reopen } = make();
        await store.commit({ putOps: [op(1)], outboxAdd: ['d:1'], meta: meta(2) });
        await store.close?.();
        const again = await reopen!().load();
        expect(again).toEqual({ meta: meta(2), snapshots: [], ops: [op(1)], outbox: ['d:1'] });
      });
    }
  });
}

describe('sqlite storage atomicity', () => {
  it('rolls back the whole transaction when a statement fails', async () => {
    const driver = nodeSqlite();
    const store = new SqliteStorage(driver);
    await store.commit({ putOps: [op(1)], meta: meta(1) });
    let calls = 0;
    const failing = new SqliteStorage({
      run: (sql, params) => {
        if (sql.startsWith('insert or ignore into accord_outbox') && ++calls === 1) {
          throw new Error('disk full');
        }
        return driver.run(sql, params);
      },
      all: driver.all,
    });
    await expect(
      failing.commit({ putOps: [op(2)], outboxAdd: ['d:2'], meta: meta(2) }),
    ).rejects.toThrow('disk full');
    const s = await store.load();
    expect(s.ops).toEqual([op(1)]);
    expect(s.meta).toEqual(meta(1));
  });
});
