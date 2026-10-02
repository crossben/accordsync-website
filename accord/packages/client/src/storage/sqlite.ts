import type { RecordSnapshot, WireOp } from '@accordsync/core';
import type { StorageAdapter, StorageSnapshot, StorageTx, StoredMeta } from './adapter';

/**
 * The two calls Accord needs from a SQLite library. Wrap yours in a few lines: wa-sqlite (web),
 * op-sqlite (React Native), better-sqlite3 or `node:sqlite` (Node).
 */
export interface SqlDriver {
  run(sql: string, params?: readonly unknown[]): Promise<void> | void;
  all<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]> | T[];
}

/** Durable storage in SQLite. Tables are prefixed `accord_`, so it can share an app's database. */
export class SqliteStorage implements StorageAdapter {
  #ready: Promise<void> | undefined;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: SqlDriver) {}

  async load(): Promise<StorageSnapshot> {
    await this.#init();
    const meta = await this.db.all<{ v: string }>(`select v from accord_meta where k = 'meta'`);
    const snapshots = await this.db.all<{ body: string }>(`select body from accord_snapshots`);
    const ops = await this.db.all<{ body: string }>(`select body from accord_ops`);
    const outbox = await this.db.all<{ op_id: string }>(`select op_id from accord_outbox`);
    return {
      meta: meta[0] ? (JSON.parse(meta[0].v) as StoredMeta) : undefined,
      snapshots: snapshots.map((r) => JSON.parse(r.body) as RecordSnapshot),
      ops: ops.map((r) => JSON.parse(r.body) as WireOp),
      outbox: outbox.map((r) => r.op_id),
    };
  }

  /** Transactions are queued, so concurrent commits never interleave on one connection. */
  commit(tx: StorageTx): Promise<void> {
    const run = this.#queue.then(() => this.#commit(tx));
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async #commit(tx: StorageTx): Promise<void> {
    await this.#init();
    const db = this.db;
    await db.run('begin immediate');
    try {
      if (tx.clearOps) {
        await db.run('delete from accord_ops');
        await db.run('delete from accord_snapshots');
      }
      for (const r of tx.deleteSnapshots ?? []) {
        await db.run('delete from accord_snapshots where record = ?', [r]);
      }
      for (const snap of tx.putSnapshots ?? []) {
        await db.run('insert or replace into accord_snapshots (record, body) values (?, ?)', [
          snap.record,
          JSON.stringify(snap),
        ]);
      }
      for (const id of tx.deleteOps ?? [])
        await db.run('delete from accord_ops where op_id = ?', [id]);
      for (const op of tx.putOps ?? []) {
        await db.run('insert or replace into accord_ops (op_id, body) values (?, ?)', [
          op.op_id,
          JSON.stringify(op),
        ]);
      }
      for (const id of tx.outboxAdd ?? []) {
        await db.run('insert or ignore into accord_outbox (op_id) values (?)', [id]);
      }
      for (const id of tx.outboxDelete ?? [])
        await db.run('delete from accord_outbox where op_id = ?', [id]);
      if (tx.meta) {
        await db.run(`insert or replace into accord_meta (k, v) values ('meta', ?)`, [
          JSON.stringify(tx.meta),
        ]);
      }
      await db.run('commit');
    } catch (e) {
      await db.run('rollback');
      throw e;
    }
  }

  #init(): Promise<void> {
    this.#ready ??= (async () => {
      await this.db.run(
        'create table if not exists accord_ops (op_id text primary key, body text not null)',
      );
      await this.db.run('create table if not exists accord_outbox (op_id text primary key)');
      await this.db.run(
        'create table if not exists accord_snapshots (record text primary key, body text not null)',
      );
      await this.db.run(
        'create table if not exists accord_meta (k text primary key, v text not null)',
      );
    })();
    return this.#ready;
  }
}
