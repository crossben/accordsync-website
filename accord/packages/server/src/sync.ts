import {
  decodeOp,
  DEFAULT_MAX_SKEW_MS,
  encodeOp,
  type Op,
  type RecordSnapshot,
  recordType,
  Replica,
  type WireOp,
} from '@accordsync/core';
import { type Insertable, sql } from 'kysely';
import type { Database, Db } from './db';
import type { ServerDefinition } from './define';
import type { Metrics } from './metrics';
import type { PullItem, PullResponse, PushResponse } from './protocol';

export class BadRequest extends Error {
  override readonly name = 'BadRequest';
}
export class Forbidden extends Error {
  override readonly name = 'Forbidden';
}

/** Who is calling: verified user, their device, and the scope keys their claims grant. */
export interface Caller {
  sub: string;
  deviceId: string;
  read: readonly string[];
  write: readonly string[];
}

export interface SyncContext {
  db: Db;
  def: ServerDefinition;
  now: () => number;
  metrics?: Metrics;
}

/**
 * Every push takes this transaction-scoped lock, so feed `seq` values commit strictly in order.
 * Without it, a puller could see seq 11 before a slower transaction commits seq 10, move its
 * cursor past 10, and never receive that op (ADR-0007).
 */
export const FEED_LOCK = 0x4acc0d;

export const DAY_MS = 24 * 3_600_000;

/** Runs tasks one at a time, in arrival order. */
class Queue {
  #tail: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(task);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}
const pushQueue = new Queue();

export function deviceTtlMs(def: ServerDefinition): number {
  return (def.compaction?.deviceTtlDays ?? 30) * DAY_MS;
}

/**
 * Registers the device to this user on first sight; refuses a device id owned by someone else.
 * A device seen again after the retirement TTL is flagged: its next pull must start from zero,
 * because compaction may have folded away ops it never received (ADR-0005).
 */
export async function touchDevice(db: Db, caller: Caller, ttlMs: number): Promise<void> {
  const row = await db
    .insertInto('devices')
    .values({ device_id: caller.deviceId, sub: caller.sub, read_keys: null })
    .onConflict((oc) =>
      oc
        .column('device_id')
        .doUpdateSet({
          last_seen: sql`now()`,
          needs_resync: sql`devices.needs_resync or devices.last_seen < now() - make_interval(secs => ${ttlMs / 1000})`,
        })
        .where('devices.sub', '=', caller.sub),
    )
    .returning('sub')
    .executeTakeFirst();
  if (!row) throw new Forbidden(`device ${caller.deviceId} belongs to another user`);
}

export async function push(
  ctx: SyncContext,
  caller: Caller,
  raw: unknown[],
): Promise<PushResponse> {
  const maxOps = ctx.def.limits?.maxPushOps ?? 500;
  if (raw.length > maxOps) throw new BadRequest(`at most ${maxOps} ops per push`);
  const maxSkewMs = ctx.def.limits?.maxSkewMs ?? DEFAULT_MAX_SKEW_MS;

  const acked: string[] = [];
  const refused: { op_id: string; reason: string }[] = [];
  let duplicates = 0;
  const byRecord = new Map<string, Op[]>();

  for (const input of raw) {
    let op: Op;
    try {
      op = decodeOp(input);
    } catch (e) {
      const opId = (input as { op_id?: unknown } | null)?.op_id;
      if (typeof opId !== 'string') throw new BadRequest(`malformed op: ${(e as Error).message}`);
      refused.push({ op_id: opId, reason: `malformed op: ${(e as Error).message}` });
      continue;
    }
    if (op.hlc.node !== caller.deviceId) {
      refused.push({ op_id: op.opId, reason: `op belongs to device ${op.hlc.node}` });
      continue;
    }
    const list = byRecord.get(op.record) ?? [];
    list.push(op);
    byRecord.set(op.record, list);
  }

  // Pushes queue here, in the process, before taking a database connection: waiting on the feed
  // lock while holding a connection would starve pulls of connections. The advisory lock below
  // still serializes pushes across several server processes.
  await pushQueue.run(() =>
    ctx.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(${FEED_LOCK})`.execute(trx);
      const now = ctx.now();

      for (const record of [...byRecord.keys()].sort()) {
        const existing = await trx
          .selectFrom('records')
          .select(['scopes', 'state'])
          .where('record', '=', record)
          .executeTakeFirst();
        let replica: Replica;
        if (existing?.state) {
          replica = new Replica(ctx.def.schema);
          replica.loadSnapshot(existing.state);
        } else {
          // A new record, or one written before migration 0004: rebuild from the feed.
          replica = await loadRecord(trx as unknown as Db, ctx.def, record);
        }
        const pending = byRecord.get(record)!;
        const ids = pending.map((o) => o.opId);
        // Already applied (in the feed) or folded by compaction: acknowledge, never apply twice.
        const seen = new Set(
          [
            ...(await trx.selectFrom('feed').select('op_id').where('op_id', 'in', ids).execute()),
            ...(await trx
              .selectFrom('compacted_ops')
              .select('op_id')
              .where('op_id', 'in', ids)
              .execute()),
          ].map((r) => r.op_id!),
        );
        let scopes: string[] | null = existing?.scopes ?? null;
        let changed = false;
        const rows: Insertable<Database['feed']>[] = [];

        for (const op of pending) {
          if (seen.has(op.opId) || replica.has(op.opId)) {
            duplicates++;
            acked.push(op.opId); // a retried push: already applied
            continue;
          }
          const reason = check(ctx, caller, replica, scopes, op, now, maxSkewMs);
          if (reason) {
            refused.push({ op_id: op.opId, reason });
            continue;
          }
          replica.apply(op);
          let next: string[];
          try {
            next = scopesOf(ctx.def, replica, record);
          } catch (e) {
            throw new Error(`scope function failed for ${record}: ${(e as Error).message}`, {
              cause: e,
            });
          }
          // A scope change goes in before the op that caused it: a device the record is entering
          // receives the history (snapshot and older ops) first, then this op on top.
          if (scopes === null || !sameKeys(scopes, next)) {
            rows.push({
              kind: 'scope',
              record,
              op_id: null,
              op: null,
              scopes: next,
              scopes_before: scopes ?? [],
            });
          }
          rows.push({
            kind: 'op',
            record,
            op_id: op.opId,
            op: encodeOp(op),
            scopes: next,
            scopes_before: null,
          });
          scopes = next;
          changed = true;
          acked.push(op.opId);
        }
        if (changed) {
          // One insert per record: rows get their seq in this order.
          await trx.insertInto('feed').values(rows).execute();
          const state = JSON.stringify(replica.snapshotRecord(record)) as never;
          await trx
            .insertInto('records')
            .values({ record, scopes: scopes!, state })
            .onConflict((oc) => oc.column('record').doUpdateSet({ scopes: scopes!, state }))
            .execute();
        }
      }
    }),
  );

  ctx.metrics?.pushBatch.observe(raw.length);
  ctx.metrics?.pushOps.inc({ result: 'duplicate' }, duplicates);
  ctx.metrics?.pushOps.inc({ result: 'refused' }, refused.length);
  ctx.metrics?.pushOps.inc({ result: 'accepted' }, acked.length - duplicates);
  return { acked, refused };
}

/** Why `op` must be refused, or undefined to accept it. */
function check(
  ctx: SyncContext,
  caller: Caller,
  replica: Replica,
  scopes: string[] | null,
  op: Op,
  now: number,
  maxSkewMs: number,
): string | undefined {
  try {
    replica.validate(op);
  } catch (e) {
    return (e as Error).message;
  }
  if (op.hlc.wall - now > maxSkewMs) {
    return `clock is ${op.hlc.wall - now} ms ahead of the server (limit ${maxSkewMs} ms)`;
  }
  // An existing record: the caller must be allowed to write where it is now. A new record: where
  // the write puts it.
  let where = scopes;
  if (where === null) {
    const fresh = new Replica(ctx.def.schema);
    fresh.apply(op);
    try {
      where = scopesOf(ctx.def, fresh, op.record);
    } catch (e) {
      return `scope function failed: ${(e as Error).message}`;
    }
  }
  if (!overlaps(where, caller.write)) return `out of scope: you may not write ${op.record}`;
  return undefined;
}

export async function pull(
  ctx: SyncContext,
  caller: Caller,
  cursor: number,
  requested: number,
): Promise<PullResponse> {
  const limit = Math.max(1, Math.min(requested, ctx.def.limits?.maxPullLimit ?? 1000));
  const read = normalize(caller.read);

  return ctx.db
    .transaction()
    .setIsolationLevel('repeatable read')
    .execute(async (trx): Promise<PullResponse> => {
      const device = await trx
        .selectFrom('devices')
        .select(['read_keys', 'needs_resync'])
        .where('device_id', '=', caller.deviceId)
        .executeTakeFirstOrThrow();
      if (cursor > 0 && (device.needs_resync || !sameKeys(device.read_keys ?? [], read))) {
        ctx.metrics?.pulls.inc({ result: 'resync_required' });
        return { resync_required: true };
      }
      // The device has applied everything up to `cursor`: compaction may fold ops below it.
      await trx
        .updateTable('devices')
        .set(
          cursor === 0
            ? { read_keys: read, needs_resync: false, cursor: '0' }
            : { cursor: sql`greatest(cursor, ${cursor})` as never },
        )
        .where('device_id', '=', caller.deviceId)
        .execute();

      const { head } = await trx
        .selectFrom('feed')
        .select(sql<string>`coalesce(max(seq), 0)`.as('head'))
        .executeTakeFirstOrThrow();
      const rows = await trx
        .selectFrom('feed')
        .select(['seq', 'kind', 'record', 'op', 'scopes', 'scopes_before'])
        .where('seq', '>', String(cursor) as never)
        .where('seq', '<=', head as never)
        .where(
          // Wrapped in parentheses: Kysely ANDs this with the seq bounds above.
          sql<boolean>`((kind in ('op', 'snapshot') and scopes && ${read}::text[])
            or (kind = 'scope' and (scopes_before && ${read}::text[]) <> (scopes && ${read}::text[])))`,
        )
        .orderBy('seq')
        .limit(limit)
        .execute();

      const items: PullItem[] = [];
      const sent = new Set<string>();
      const send = (row: { kind: string; op: unknown }) => {
        if (row.kind === 'snapshot') {
          items.push({ type: 'snapshot', snapshot: row.op as RecordSnapshot });
          return;
        }
        const op = row.op as WireOp;
        if (sent.has(op.op_id)) return;
        sent.add(op.op_id);
        items.push({ type: 'op', op });
      };
      for (const row of rows) {
        if (row.kind === 'op' || row.kind === 'snapshot') {
          send(row);
          continue;
        }
        if (overlaps(row.scopes, read)) {
          // The record entered the caller's scope: send its whole history up to this point.
          const history = await trx
            .selectFrom('feed')
            .select(['kind', 'op'])
            .where('record', '=', row.record)
            .where('kind', 'in', ['op', 'snapshot'])
            .where('seq', '<', row.seq as never)
            .orderBy('seq')
            .execute();
          for (const h of history) send(h);
        } else {
          items.push({ type: 'exit', record: row.record });
        }
      }

      const full = rows.length === limit;
      const next = full ? Number(rows[rows.length - 1]!.seq) : Number(head);
      ctx.metrics?.pulls.inc({ result: 'page' });
      ctx.metrics?.pullItems.inc(items.length);
      return { items, cursor: Math.max(cursor, next), has_more: full && next < Number(head) };
    });
}

/** A record's state on the server: its latest snapshot, then the ops after it. */
export async function loadRecord(db: Db, def: ServerDefinition, record: string): Promise<Replica> {
  const replica = new Replica(def.schema);
  const rows = await db
    .selectFrom('feed')
    .select(['kind', 'op'])
    .where('record', '=', record)
    .where('kind', 'in', ['op', 'snapshot'])
    .orderBy('seq')
    .execute();
  for (const row of rows) {
    if (row.kind === 'snapshot') replica.loadSnapshot(row.op as RecordSnapshot);
    else replica.apply(decodeOp(row.op));
  }
  return replica;
}

function scopesOf(def: ServerDefinition, replica: Replica, record: string): string[] {
  const fn = def.scopes[recordType(record)];
  if (!fn) throw new Error(`no scope function for ${recordType(record)}`);
  return normalize(fn({ id: record, fields: replica.read(record) ?? {} }));
}

function normalize(keys: readonly string[]): string[] {
  return [...new Set(keys)].sort();
}

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  const s = new Set(b);
  return a.some((k) => s.has(k));
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  const x = normalize(a);
  const y = normalize(b);
  return x.length === y.length && x.every((k, i) => k === y[i]);
}
