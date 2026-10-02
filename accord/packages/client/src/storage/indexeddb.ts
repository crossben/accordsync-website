import type { RecordSnapshot, WireOp } from '@accordsync/core';
import type { StorageAdapter, StorageSnapshot, StorageTx, StoredMeta } from './adapter';

const STORES = ['ops', 'outbox', 'meta', 'snapshots'] as const;

/** Durable storage in the browser's IndexedDB. One database per Accord client. */
export class IndexedDbStorage implements StorageAdapter {
  #db: Promise<IDBDatabase> | undefined;

  constructor(
    private readonly name = 'accord',
    private readonly factory: IDBFactory = globalThis.indexedDB,
  ) {}

  async load(): Promise<StorageSnapshot> {
    const db = await this.#open();
    const tx = db.transaction(STORES, 'readonly');
    const [ops, outbox, meta, snapshots] = await Promise.all([
      req<WireOp[]>(tx.objectStore('ops').getAll()),
      req<IDBValidKey[]>(tx.objectStore('outbox').getAllKeys()),
      req<StoredMeta | undefined>(tx.objectStore('meta').get('meta')),
      req<RecordSnapshot[]>(tx.objectStore('snapshots').getAll()),
    ]);
    return { meta, snapshots, ops, outbox: outbox.map(String) };
  }

  async commit(t: StorageTx): Promise<void> {
    const db = await this.#open();
    const tx = db.transaction(STORES, 'readwrite');
    const ops = tx.objectStore('ops');
    const outbox = tx.objectStore('outbox');
    const snapshots = tx.objectStore('snapshots');
    if (t.clearOps) {
      ops.clear();
      snapshots.clear();
    }
    for (const r of t.deleteSnapshots ?? []) snapshots.delete(r);
    for (const snap of t.putSnapshots ?? []) snapshots.put(snap);
    for (const id of t.deleteOps ?? []) ops.delete(id);
    for (const op of t.putOps ?? []) ops.put(op);
    for (const id of t.outboxAdd ?? []) outbox.put(true, id);
    for (const id of t.outboxDelete ?? []) outbox.delete(id);
    if (t.meta) tx.objectStore('meta').put(t.meta, 'meta');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  async close(): Promise<void> {
    if (this.#db) (await this.#db).close();
  }

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise((resolve, reject) => {
      const open = this.factory.open(this.name, 2);
      open.onupgradeneeded = (e) => {
        const db = open.result;
        if (e.oldVersion < 1) {
          db.createObjectStore('ops', { keyPath: 'op_id' });
          db.createObjectStore('outbox');
          db.createObjectStore('meta');
        }
        if (e.oldVersion < 2) db.createObjectStore('snapshots', { keyPath: 'record' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    return this.#db;
  }
}

function req<T>(r: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}
