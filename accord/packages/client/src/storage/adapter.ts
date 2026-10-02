import type { RecordSnapshot, WireOp } from '@accordsync/core';

/** What a device must remember between launches. */
export interface StoredMeta {
  deviceId: string;
  /** Pull cursor: server feed position already applied. */
  cursor: number;
  /** Last clock and op sequence number, so op ids are never reused after a restart. */
  hlc: string;
  seq: number;
}

export interface StorageSnapshot {
  meta: StoredMeta | undefined;
  /** Compacted records: their state with older ops folded away (ADR-0008). Loaded before ops. */
  snapshots: RecordSnapshot[];
  /** Every op the device holds (its own and received). */
  ops: WireOp[];
  /** Ids of local ops not yet acknowledged by the server. */
  outbox: string[];
}

/** One atomic change. Applied in this order: clear, delete, put, outbox changes, meta. */
export interface StorageTx {
  /** Removes every op and snapshot. */
  clearOps?: boolean;
  deleteSnapshots?: readonly string[];
  putSnapshots?: readonly RecordSnapshot[];
  deleteOps?: readonly string[];
  putOps?: readonly WireOp[];
  outboxAdd?: readonly string[];
  outboxDelete?: readonly string[];
  meta?: StoredMeta;
}

/**
 * Durable storage for a device. `commit` must be atomic: after a crash, either all of a
 * transaction is visible or none of it.
 */
export interface StorageAdapter {
  load(): Promise<StorageSnapshot>;
  commit(tx: StorageTx): Promise<void>;
  close?(): Promise<void>;
}
