import {
  decodeHlc,
  decodeOp,
  encodeHlc,
  encodeOp,
  type FieldRead,
  type JsonValue,
  LocalWriter,
  type Op,
  parseOpId,
  type RecordSnapshot,
  type Schema,
  type SetElement,
} from '@accordsync/core';
import type { StorageAdapter, StorageTx, StoredMeta } from './storage/adapter';
import type { PullItem, Transport } from './transport';

export interface ClientOptions {
  schema: Schema;
  storage: StorageAdapter;
  transport: Transport;
  /** Used only the first time; afterwards the stored id is kept. Generated when absent. */
  deviceId?: string;
  now?: () => number;
  random?: () => number;
  /** Ops per push request (default 200) and items per pull page (default 500). */
  pushBatch?: number;
  pullLimit?: number;
  /** Background sync: pause between successful rounds, and the retry backoff bounds. */
  syncIntervalMs?: number;
  minBackoffMs?: number;
  maxBackoffMs?: number;
}

/** A local write the server refused. It has already been rolled back on this device. */
export interface Refusal {
  opId: string;
  record: string;
  field: string;
  reason: string;
}

export interface ConflictInfo {
  record: string;
  field: string;
  values: { value: JsonValue; opId: string }[];
}

export interface ClientEvents {
  /** Local state changed (a local write, ops received, a rollback, a record leaving scope). */
  change: { records: string[] };
  refused: Refusal;
  /** A sync round finished: everything pushed, everything available pulled. */
  synced: { cursor: number };
  /** The server asked for a resync (read scopes changed); local data was reloaded. */
  resync: Record<string, never>;
  /** A sync round failed; background sync will retry with backoff. */
  error: { error: unknown };
}

type Listener<K extends keyof ClientEvents> = (e: ClientEvents[K]) => void;

/**
 * An Accord device. Writes apply locally at once and are saved to storage; sync pushes them and
 * pulls everyone else's, in the background or on demand.
 */
export class AccordClient {
  readonly deviceId: string;
  #writer: LocalWriter;
  readonly #o: Required<Omit<ClientOptions, 'deviceId'>>;
  /** Unacknowledged local ops, by id, in write order. */
  readonly #outbox = new Map<string, Op>();
  #cursor: number;
  #chain: Promise<void> = Promise.resolve();
  #syncing: Promise<void> | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running = false;
  #failures = 0;
  #lastSyncAt: number | undefined;
  #lastError: unknown;
  readonly #listeners = new Map<keyof ClientEvents, Set<(e: never) => void>>();

  private constructor(
    o: Required<Omit<ClientOptions, 'deviceId'>>,
    deviceId: string,
    meta: StoredMeta | undefined,
  ) {
    this.#o = o;
    this.deviceId = deviceId;
    this.#cursor = meta?.cursor ?? 0;
    this.#writer = this.#newWriter(meta ? { hlc: decodeHlc(meta.hlc), seq: meta.seq } : undefined);
  }

  /** Opens the device: loads its stored ops, outbox and cursor. */
  static async open(opts: ClientOptions): Promise<AccordClient> {
    const o = {
      now: Date.now,
      random: Math.random,
      pushBatch: 200,
      pullLimit: 500,
      syncIntervalMs: 30_000,
      minBackoffMs: 1_000,
      maxBackoffMs: 60_000,
      ...opts,
    };
    const snap = await o.storage.load();
    const deviceId =
      snap.meta?.deviceId ?? opts.deviceId ?? `d${crypto.randomUUID().replaceAll('-', '')}`;
    const client = new AccordClient(o, deviceId, snap.meta);
    for (const base of snap.snapshots) client.#writer.replica.loadSnapshot(base);
    for (const raw of snap.ops) client.#writer.receive(decodeOp(raw));
    for (const id of [...snap.outbox].sort(bySeq)) {
      const op = snap.ops.find((x) => x.op_id === id);
      if (op) client.#outbox.set(id, decodeOp(op));
    }
    if (!snap.meta) await client.#persist({});
    return client;
  }

  // ── reading ────────────────────────────────────────────────────────────

  /** A record's fields, or `undefined` if this device has never seen it. */
  read(record: string): Record<string, FieldRead> | undefined {
    return this.#writer.replica.read(record);
  }

  records(type?: string): string[] {
    const all = this.#writer.replica.records();
    return type ? all.filter((r) => r.startsWith(`${type}:`)) : all;
  }

  /** Every `conflict()` field holding more than one value, with the values. */
  conflicts(): ConflictInfo[] {
    return this.#writer.replica.conflicts().map(({ record, field }) => {
      const v = this.read(record)?.[field] as { conflicted: ConflictInfo['values'] };
      return { record, field, values: v.conflicted };
    });
  }

  status(): {
    pending: number;
    cursor: number;
    lastSyncAt: number | undefined;
    lastError: unknown;
  } {
    return {
      pending: this.#outbox.size,
      cursor: this.#cursor,
      lastSyncAt: this.#lastSyncAt,
      lastError: this.#lastError,
    };
  }

  // ── writing (local-first) ──────────────────────────────────────────────

  /** Sets a `lww` or `conflict` field. Resolves once the write is saved on this device. */
  assign(record: string, field: string, value: JsonValue): Promise<Op> {
    return this.#write(this.#writer.assign(record, field, value));
  }

  /** Resolves a conflicted field: writes `value`, superseding every value currently shown. */
  resolve(record: string, field: string, value: JsonValue): Promise<Op> {
    return this.assign(record, field, value);
  }

  inc(record: string, field: string, by: number): Promise<Op> {
    return this.#write(this.#writer.inc(record, field, by));
  }

  add(record: string, field: string, element: SetElement): Promise<Op> {
    return this.#write(this.#writer.add(record, field, element));
  }

  remove(record: string, field: string, element: SetElement): Promise<Op> {
    return this.#write(this.#writer.remove(record, field, element));
  }

  async #write(op: Op): Promise<Op> {
    this.#outbox.set(op.opId, op);
    this.#emit('change', { records: [op.record] });
    await this.#persist({ putOps: [encodeOp(op)], outboxAdd: [op.opId] });
    this.#soon();
    return op;
  }

  // ── sync ───────────────────────────────────────────────────────────────

  /** One full round: push the outbox, then pull every page. Concurrent calls share the round. */
  sync(): Promise<void> {
    this.#syncing ??= this.#round().finally(() => (this.#syncing = undefined));
    return this.#syncing;
  }

  /** Syncs in the background: after each write, every `syncIntervalMs`, and with backoff on errors. */
  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#schedule(0);
  }

  stop(): void {
    this.#running = false;
    clearTimeout(this.#timer);
  }

  /** Waits for pending local saves. */
  flush(): Promise<void> {
    return this.#chain;
  }

  async close(): Promise<void> {
    this.stop();
    await this.#syncing?.catch(() => undefined);
    await this.flush();
    await this.#o.storage.close?.();
  }

  on<K extends keyof ClientEvents>(event: K, fn: Listener<K>): () => void {
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, (set = new Set()));
    set.add(fn as (e: never) => void);
    return () => set.delete(fn as (e: never) => void);
  }

  async #round(): Promise<void> {
    await this.#pushAll();
    for (;;) {
      const page = await this.#o.transport.pull(this.deviceId, this.#cursor, this.#o.pullLimit);
      if ('resync_required' in page) {
        await this.#pushAll();
        await this.#resync();
        continue;
      }
      // The server's count of this device's ops: never reuse an op id, even after lost storage.
      if (page.device_seq !== undefined) this.#writer.advanceSeq(page.device_seq);
      await this.#applyPage(page.items, page.cursor);
      if (!page.has_more) break;
    }
    this.#lastSyncAt = this.#o.now();
    this.#lastError = undefined;
    this.#failures = 0;
    this.#emit('synced', { cursor: this.#cursor });
  }

  async #pushAll(): Promise<void> {
    while (this.#outbox.size > 0) {
      const batch = [...this.#outbox.values()].slice(0, this.#o.pushBatch);
      const res = await this.#o.transport.push(this.deviceId, batch.map(encodeOp));
      if (res.acked.length + res.refused.length === 0) {
        throw new Error('server neither acknowledged nor refused a non-empty push');
      }
      for (const id of res.acked) this.#outbox.delete(id);
      const refusals: Refusal[] = [];
      for (const r of res.refused) {
        const op = this.#outbox.get(r.op_id);
        this.#outbox.delete(r.op_id);
        if (op)
          refusals.push({ opId: op.opId, record: op.record, field: op.field, reason: r.reason });
      }
      if (refusals.length > 0) this.#writer.discard(refusals.map((r) => r.opId));
      await this.#persist({
        outboxDelete: [...res.acked, ...res.refused.map((r) => r.op_id)],
        deleteOps: refusals.map((r) => r.opId),
      });
      if (refusals.length > 0)
        this.#emit('change', { records: unique(refusals.map((r) => r.record)) });
      for (const r of refusals) this.#emit('refused', r);
    }
  }

  async #applyPage(items: PullItem[], cursor: number): Promise<void> {
    const put = new Map<string, Op>();
    const forgotten: string[] = [];
    const snapshots: RecordSnapshot[] = [];
    const dropSnapshots: string[] = [];
    const changed = new Set<string>();
    const pending = new Set(this.#outbox.keys());
    const notPending = (record: string) =>
      this.#writer.replica
        .ops()
        .filter((o) => o.record === record && !pending.has(o.opId))
        .map((o) => o.opId);
    for (const item of items) {
      if (item.type === 'op') {
        const op = decodeOp(item.op);
        if (this.#writer.receive(op) === 'applied') {
          put.set(op.opId, op);
          changed.add(op.record);
        }
      } else if (item.type === 'snapshot') {
        // A compacted record: its snapshot replaces the ops it folded; our unpushed edits stay on
        // top. The server sends a snapshot before any later op of that record.
        const record = item.snapshot.record;
        for (const id of notPending(record)) {
          put.delete(id);
          forgotten.push(id);
        }
        this.#writer.replica.loadSnapshot(item.snapshot, pending);
        snapshots.push(item.snapshot);
        changed.add(record);
      } else {
        // The record left our scope: forget it, except our own unpushed edits, which will be
        // pushed, refused and rolled back like any other refused write.
        const ids = notPending(item.record);
        for (const id of ids) put.delete(id);
        this.#writer.forget(item.record, pending);
        forgotten.push(...ids);
        dropSnapshots.push(item.record);
        changed.add(item.record);
      }
    }
    this.#cursor = Math.max(this.#cursor, cursor);
    await this.#persist({
      deleteOps: forgotten,
      deleteSnapshots: dropSnapshots.filter((r) => !snapshots.some((s) => s.record === r)),
      putSnapshots: snapshots.filter((s) => !dropSnapshots.includes(s.record)),
      putOps: [...put.values()].map(encodeOp),
    });
    if (changed.size > 0) this.#emit('change', { records: [...changed] });
  }

  /** Read scopes changed: keep only unpushed local ops and pull everything again from zero. */
  async #resync(): Promise<void> {
    const keep = [...this.#outbox.values()];
    const before = this.#writer.replica.records();
    this.#writer = this.#newWriter({ hlc: this.#writer.clock, seq: this.#writer.seq });
    for (const op of keep) this.#writer.receive(op);
    this.#cursor = 0;
    await this.#persist({ clearOps: true, putOps: keep.map(encodeOp) });
    this.#emit('resync', {});
    this.#emit('change', { records: before });
  }

  #schedule(delay: number): void {
    clearTimeout(this.#timer);
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.sync().then(
        () => this.#schedule(this.#o.syncIntervalMs),
        (error: unknown) => {
          this.#failures++;
          this.#lastError = error;
          this.#emit('error', { error });
          const base = Math.min(
            this.#o.maxBackoffMs,
            this.#o.minBackoffMs * 2 ** (this.#failures - 1),
          );
          this.#schedule(base * (0.5 + this.#o.random() / 2)); // jitter: phones don't retry in lockstep
        },
      );
    }, delay);
  }

  /** After a write, sync shortly (writes in a burst share one round). */
  #soon(): void {
    if (this.#running && this.#failures === 0) this.#schedule(50);
  }

  #newWriter(resume: { hlc: ReturnType<typeof decodeHlc>; seq: number } | undefined): LocalWriter {
    return new LocalWriter({
      schema: this.#o.schema,
      deviceId: this.deviceId,
      now: this.#o.now,
      // The server already refused ops with absurd clocks; a device with a wrong clock of its own
      // must still accept everything the server sends.
      maxSkewMs: Number.POSITIVE_INFINITY,
      ...(resume ? { resume } : {}),
    });
  }

  #persist(tx: Omit<StorageTx, 'meta'>): Promise<void> {
    const meta: StoredMeta = {
      deviceId: this.deviceId,
      cursor: this.#cursor,
      hlc: encodeHlc(this.#writer.clock),
      seq: this.#writer.seq,
    };
    const run = this.#chain.then(() => this.#o.storage.commit({ ...tx, meta }));
    this.#chain = run.catch(() => undefined);
    return run;
  }

  #emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]): void {
    for (const fn of this.#listeners.get(event) ?? []) {
      try {
        (fn as Listener<K>)(payload);
      } catch (e) {
        console.error(`accord: a "${event}" listener threw`, e);
      }
    }
  }
}

function bySeq(a: string, b: string): number {
  return parseOpId(a).seq - parseOpId(b).seq;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
