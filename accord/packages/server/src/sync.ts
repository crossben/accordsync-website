import {
  canonicalJson,
  decodeOp,
  DEFAULT_MAX_SKEW_MS,
  encodeOp,
  type Op,
  parseOpId,
  type RecordSnapshot,
  recordType,
  Replica,
  type WireOp,
} from '@accordsync/core';
import { createHash } from 'node:crypto';
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

/** Runs at most `size` tasks at once; the rest wait their turn, in arrival order. */
class Slots {
  #free: number;
  readonly #waiting: (() => void)[] = [];
  constructor(size: number) {
    this.#free = size;
  }
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.#free > 0) this.#free--;
    else await new Promise<void>((resolve) => this.#waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = this.#waiting.shift();
      if (next) next();
      else this.#free++;
    }
  }
}
const slotsByDef = new WeakMap<ServerDefinition, Slots>();
function pushSlots(ctx: SyncContext): Slots {
  let slots = slotsByDef.get(ctx.def);
  if (!slots)
    slotsByDef.set(ctx.def, (slots = new Slots(ctx.def.limits?.maxConcurrentPushes ?? 8)));
  return slots;
}

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
      // PostgreSQL cannot store a lone surrogate (jsonb refuses it, text replaces it): refuse the
      // op instead of failing the whole push.
      const bad = lonePath(input);
      if (bad !== undefined) throw new Error(`lone surrogate in ${bad}`);
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

  // Pushes run concurrently. Each takes the feed lock in shared mode (only compaction takes it
  // exclusively) and locks the rows of the records it writes, in sorted order so two pushes can
  // never deadlock. Pulls stay correct because they read the feed in transaction order and only up
  // to the oldest transaction still running (ADR-0010). A limit per process keeps connections free
  // for pulls.
  await pushSlots(ctx).run(() =>
    ctx.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock_shared(${FEED_LOCK})`.execute(trx);
      // Op numbers this device already used (read once: within a batch, ops apply out of order).
      const usedUpTo = Number(
        (
          await trx
            .selectFrom('devices')
            .select('max_op_seq')
            .where('device_id', '=', caller.deviceId)
            .executeTakeFirst()
        )?.max_op_seq ?? 0,
      );
      let maxApplied = 0;
      const now = ctx.now();
      const records = [...byRecord.keys()].sort();

      // Create missing record rows, so every record can be locked; a row created here and left
      // unused (every op refused) is removed again below.
      const created = new Set(
        records.length === 0
          ? []
          : (
              await trx
                .insertInto('records')
                .values(records.map((record) => ({ record, scopes: [], state: null })))
                .onConflict((oc) => oc.column('record').doNothing())
                .returning('record')
                .execute()
            ).map((r) => r.record),
      );
      const locked = new Map(
        (
          await trx
            .selectFrom('records')
            .select(['record', 'scopes', 'state'])
            .where('record', 'in', records.length ? records : [''])
            .orderBy('record')
            .forUpdate()
            .execute()
        ).map((r) => [r.record, r]),
      );

      for (const record of records) {
        const isNew = created.has(record);
        const existing = locked.get(record)!;
        let replica: Replica;
        if (existing.state) {
          replica = new Replica(ctx.def.schema);
          replica.loadSnapshot(existing.state);
        } else {
          // A new record, or one written before migration 0004: rebuild from the feed.
          replica = await loadRecord(trx as unknown as Db, ctx.def, record);
        }
        const pending = byRecord.get(record)!;
        const ids = pending.map((o) => o.opId);
        // Already applied (in the feed) or folded by compaction: acknowledge, never apply twice.
        // Checked after taking the record lock, so a concurrent retry of the same op is seen.
        // An id already in the feed is a retry only if it is the same op; the same id with other
        // content means the device reused an id (lost storage) and must be refused, not dropped.
        const stored = new Map(
          (
            await trx.selectFrom('feed').select(['op_id', 'op']).where('op_id', 'in', ids).execute()
          ).map((r) => [r.op_id!, canonicalJson(r.op)]),
        );
        // Folded ops keep a hash of their content (migration 0006): null only for rows folded
        // before it, which are acknowledged as before.
        const compacted = new Map(
          (
            await trx
              .selectFrom('compacted_ops')
              .select(['op_id', 'op_hash'])
              .where('op_id', 'in', ids)
              .execute()
          ).map((r) => [r.op_id, r.op_hash]),
        );
        let scopes: string[] | null = isNew ? null : existing.scopes;
        let changed = false;
        const rows: Insertable<Database['feed']>[] = [];

        for (const op of pending) {
          const previous = stored.get(op.opId);
          if (previous !== undefined && previous !== canonicalJson(encodeOp(op))) {
            refused.push({
              op_id: op.opId,
              reason: `op id already used: ${op.opId} names another op`,
            });
            continue;
          }
          const folded = compacted.get(op.opId);
          if (typeof folded === 'string' && folded !== opHash(encodeOp(op))) {
            refused.push({
              op_id: op.opId,
              reason: `op id already used: ${op.opId} names another op`,
            });
            continue;
          }
          if (previous !== undefined || compacted.has(op.opId) || replica.has(op.opId)) {
            duplicates++;
            acked.push(op.opId); // a retried push: already applied
            continue;
          }
          const opSeq = parseOpId(op.opId).seq;
          if (opSeq <= usedUpTo) {
            // Not a retry (that would be in the feed): the device reused an op id, typically after
            // losing its storage. Refuse it loudly rather than acknowledge it as a duplicate.
            refused.push({
              op_id: op.opId,
              reason: `op id already used: this device's ops are numbered above ${usedUpTo}`,
            });
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
          maxApplied = Math.max(maxApplied, opSeq);
        }
        if (changed) {
          // One insert per record: rows keep this order (same transaction, increasing seq).
          await trx.insertInto('feed').values(rows).execute();
          await trx
            .updateTable('records')
            .set({
              scopes: scopes!,
              state: JSON.stringify(replica.snapshotRecord(record)) as never,
            })
            .where('record', '=', record)
            .execute();
        } else if (isNew) {
          await trx.deleteFrom('records').where('record', '=', record).execute();
        }
      }

      // The device has its answers for every op below the first one it sent now (clients push
      // their outbox in order): compacted-op entries below that can be forgotten.
      const seqs = raw
        .map((r) => (r as { op_id?: unknown } | null)?.op_id)
        .filter(
          (id): id is string => typeof id === 'string' && id.startsWith(`${caller.deviceId}:`),
        )
        .map((id) => Number(id.slice(caller.deviceId.length + 1)))
        .filter(Number.isSafeInteger);
      if (seqs.length > 0) {
        await trx
          .updateTable('devices')
          .set({
            push_floor: sql`greatest(push_floor, ${Math.min(...seqs)})` as never,
            max_op_seq: sql`greatest(max_op_seq, ${maxApplied})` as never,
          })
          .where('device_id', '=', caller.deviceId)
          .execute();
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

  // Two pulls from one device at once can collide on its `devices` row under repeatable read
  // (PostgreSQL error 40001). The pull only reads the feed, so running it again is always safe.
  for (let attempt = 1; ; attempt++) {
    try {
      return await pullOnce(ctx, caller, cursor, limit, read);
    } catch (e) {
      // Each round of colliding pulls lets at least one through, so this always ends; the jitter
      // keeps retries from colliding again in lockstep.
      if ((e as { code?: unknown }).code !== '40001' || attempt >= 20) throw e;
      await new Promise((r) => setTimeout(r, Math.random() * 10 * attempt));
    }
  }
}

async function pullOnce(
  ctx: SyncContext,
  caller: Caller,
  cursor: number,
  limit: number,
  read: string[],
): Promise<PullResponse> {
  return ctx.db
    .transaction()
    .setIsolationLevel('repeatable read')
    .execute(async (trx): Promise<PullResponse> => {
      const device = await trx
        .selectFrom('devices')
        .select(['read_keys', 'needs_resync', 'max_op_seq', 'delta_keys', 'delta_cursor'])
        .where('device_id', '=', caller.deviceId)
        .executeTakeFirstOrThrow();
      if (cursor > 0 && device.needs_resync) {
        ctx.metrics?.pulls.inc({ result: 'resync_required' });
        return { resync_required: true };
      }
      // Read scopes changed (new claims): send what entered and what left, instead of everything.
      // A delta stays pending until the device pulls from a cursor above the one it was sent from
      // (it then has the answer). A pull at or below that cursor is a retry of a lost answer: the
      // delta is computed again from the keys the device had before it (ADR-0011, 2026-10-07).
      const pending =
        device.delta_keys !== null && device.delta_cursor !== null
          ? { keys: device.delta_keys, cursor: Number(device.delta_cursor) }
          : undefined;
      const retry = cursor > 0 && pending !== undefined && cursor <= pending.cursor;
      const before = retry ? pending!.keys : (device.read_keys ?? []);
      const keysChanged = cursor > 0 && !sameKeys(before, read);
      let delta: { history: { kind: string; op: unknown }[]; exits: string[] } | undefined;
      if (keysChanged) {
        delta = await scopeDelta(
          trx as unknown as Db,
          before,
          read,
          ctx.def.limits?.maxScopeDelta ?? 2000,
        );
        if (!delta) {
          ctx.metrics?.pulls.inc({ result: 'resync_required' });
          return { resync_required: true };
        }
      }
      // The device has applied everything up to `cursor`: compaction may fold ops below it.
      await trx
        .updateTable('devices')
        .set(
          cursor === 0
            ? {
                read_keys: read,
                needs_resync: false,
                cursor: '0',
                delta_keys: null,
                delta_cursor: null,
              }
            : {
                cursor: sql`greatest(cursor, ${cursor})` as never,
                ...(keysChanged
                  ? {
                      read_keys: read,
                      delta_keys: before,
                      delta_cursor: retry ? pending!.cursor : cursor,
                    }
                  : pending
                    ? { read_keys: read, delta_keys: null, delta_cursor: null }
                    : {}),
              },
        )
        .where('device_id', '=', caller.deviceId)
        .execute();

      // Rows from transactions older than every transaction still running are final: nothing can
      // ever be inserted below this horizon (ADR-0010).
      const horizon = (await sql<{ h: string }>`select accord_horizon() as h`.execute(trx)).rows[0]!
        .h;
      const visible = sql<boolean>`((kind in ('op', 'snapshot') and scopes && ${read}::text[])
            or (kind = 'scope' and (scopes_before && ${read}::text[]) <> (scopes && ${read}::text[])))`;
      const fetched = await trx
        .selectFrom('feed')
        .select(['seq', 'pos', 'kind', 'record', 'op', 'scopes', 'scopes_before'])
        .where('pos', '>', String(cursor) as never)
        .where('pos', '<', horizon as never)
        // Wrapped in parentheses: Kysely ANDs this with the bounds above.
        .where(visible)
        .orderBy('pos')
        .orderBy('seq')
        .limit(limit + 1)
        .execute();

      // A page ends on a transaction boundary, because the cursor is a transaction position. If one
      // transaction alone is bigger than a page, it is sent whole.
      let rows = fetched;
      let full = false;
      if (fetched.length > limit) {
        full = true;
        const lastPos = fetched[limit]!.pos;
        rows = fetched.slice(0, limit).filter((r) => r.pos !== lastPos);
        if (rows.length === 0) {
          rows = await trx
            .selectFrom('feed')
            .select(['seq', 'pos', 'kind', 'record', 'op', 'scopes', 'scopes_before'])
            .where('pos', '=', lastPos as never)
            .where(visible)
            .orderBy('seq')
            .execute();
        }
      }

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
      if (delta) {
        for (const h of delta.history) send(h);
        for (const record of delta.exits) items.push({ type: 'exit', record });
      }
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
            .where(sql<boolean>`(pos, seq) < (${row.pos}::bigint, ${row.seq}::bigint)`)
            .orderBy('pos')
            .orderBy('seq')
            .execute();
          for (const h of history) send(h);
        } else {
          items.push({ type: 'exit', record: row.record });
        }
      }

      // A full page ends at its last transaction; otherwise everything below the horizon was read.
      const next = full ? Number(rows[rows.length - 1]!.pos) : Number(horizon) - 1;
      ctx.metrics?.pulls.inc({ result: 'page' });
      ctx.metrics?.pullItems.inc(items.length);
      return {
        items,
        cursor: Math.max(cursor, next),
        has_more: full,
        device_seq: Number(device.max_op_seq),
      };
    });
}

/**
 * What a change of read keys means for a device: the history of every record now visible that was
 * not visible before, and an exit for every record no longer visible at all. Computed from current
 * scopes, so a record that moved since the device's cursor is still right; extra history or a
 * repeated exit later in the feed is harmless (ops are idempotent). `undefined` when the change
 * touches more than `max` records: a full resync is cheaper then.
 */
async function scopeDelta(
  db: Db,
  before: readonly string[],
  after: readonly string[],
  max: number,
): Promise<{ history: { kind: string; op: unknown }[]; exits: string[] } | undefined> {
  const was = [...before];
  const now = [...after];
  const entering = await db
    .selectFrom('records')
    .select('record')
    .where(sql<boolean>`scopes && ${now}::text[] and not (scopes && ${was}::text[])`)
    .limit(max + 1)
    .execute();
  const leaving = await db
    .selectFrom('records')
    .select('record')
    .where(sql<boolean>`scopes && ${was}::text[] and not (scopes && ${now}::text[])`)
    .limit(max + 1)
    .execute();
  if (entering.length + leaving.length > max) return undefined;
  const history =
    entering.length === 0
      ? []
      : await db
          .selectFrom('feed')
          .select(['kind', 'op'])
          .where(
            'record',
            'in',
            entering.map((r) => r.record),
          )
          .where('kind', 'in', ['op', 'snapshot'])
          .orderBy('record')
          .orderBy('pos')
          .orderBy('seq')
          .execute();
  return { history, exits: leaving.map((r) => r.record) };
}

/** A surrogate that is not half of a pair (with the u flag, pairs read as one code point). */
const LONE = /\p{Cs}/u;

/** Where a lone surrogate hides in a JSON value (a key or a string), or undefined if nowhere. */
function lonePath(value: unknown, path = 'op'): string | undefined {
  if (typeof value === 'string') return LONE.test(value) ? path : undefined;
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const found = lonePath(v, `${path}[${i}]`);
      if (found) return found;
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (LONE.test(k)) return `${path} (a key)`;
      const found = lonePath(v, `${path}.${k}`);
      if (found) return found;
    }
  }
  return undefined;
}

/** A record's state on the server: its latest snapshot, then the ops after it. */
export async function loadRecord(db: Db, def: ServerDefinition, record: string): Promise<Replica> {
  const replica = new Replica(def.schema);
  const rows = await db
    .selectFrom('feed')
    .select(['kind', 'op'])
    .where('record', '=', record)
    .where('kind', 'in', ['op', 'snapshot'])
    .orderBy('pos')
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

/**
 * The hash a compacted op is remembered by: SHA-256, hex, of the UTF-8 canonical JSON of its wire
 * form. Every server implementation must compute it the same way (it is stored in the database).
 */
export function opHash(op: WireOp): string {
  return createHash('sha256').update(canonicalJson(op), 'utf8').digest('hex');
}
