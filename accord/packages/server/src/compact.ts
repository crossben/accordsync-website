import { parseOpId } from '@accordsync/core';
import { sql } from 'kysely';
import type { Db } from './db';
import type { ServerDefinition } from './define';
import type { Metrics } from './metrics';
import { deviceTtlMs, FEED_LOCK, loadRecord } from './sync';

export interface CompactionResult {
  /** Feed position every live device has applied: only ops at or below it were folded. */
  watermark: number;
  records: number;
  opsFolded: number;
  /** Compacted-op entries forgotten because their devices have pushed past them. */
  tombstonesPruned: number;
}

/**
 * Folds the history of records that every live device already has into one snapshot row per
 * record (ADR-0005, ADR-0008). The snapshot takes the `seq` of the last op it replaces, so live
 * devices, whose cursors are past it, never receive it; devices starting from zero, and records
 * entering someone's scope, get the snapshot instead of the old ops.
 */
export async function compact(
  db: Db,
  def: ServerDefinition,
  metrics?: Metrics,
): Promise<CompactionResult> {
  const minOps = def.compaction?.minOps ?? 20;
  const ttlSecs = deviceTtlMs(def) / 1000;

  return db.transaction().execute(async (trx) => {
    // Exclusive: waits for running pushes (they hold the lock shared) and holds new ones back, so
    // the ops being folded cannot change underneath (ADR-0010).
    await sql`select pg_advisory_xact_lock(${FEED_LOCK})`.execute(trx);
    await sql`select set_config('accord.compaction', 'on', true)`.execute(trx);

    const watermark = (
      await sql<{ w: string }>`select coalesce(
          (select min(cursor) from devices where last_seen > now() - make_interval(secs => ${ttlSecs})),
          accord_horizon() - 1) as w`.execute(trx)
    ).rows[0]!.w;

    const candidates = await trx
      .selectFrom('feed')
      .select(['record', sql<string>`max(pos)`.as('last')])
      .where('kind', 'in', ['op', 'snapshot'])
      .groupBy('record')
      .having(sql<string>`max(pos)`, '<=', watermark as never)
      .having(sql`count(*) filter (where kind = 'op')`, '>=', minOps)
      .execute();

    let opsFolded = 0;
    for (const { record, last } of candidates) {
      const replica = await loadRecord(trx as unknown as Db, def, record);
      const folded = replica.ops().map((o) => o.opId);
      const { scopes } = await trx
        .selectFrom('records')
        .select('scopes')
        .where('record', '=', record)
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('compacted_ops')
        .values(
          folded.map((op_id) => {
            const { device, seq } = parseOpId(op_id);
            return { op_id, device, op_seq: String(seq) };
          }),
        )
        .onConflict((oc) => oc.doNothing())
        .execute();
      await trx
        .deleteFrom('feed')
        .where('record', '=', record)
        .where('pos', '<=', last as never)
        .execute();
      // The snapshot takes the position of the last op it replaces: live devices are past it.
      await sql`insert into feed (pos, kind, record, op, scopes)
        values (${last}, 'snapshot', ${record}, ${JSON.stringify(replica.snapshotRecord(record))}::jsonb, ${scopes}::text[])`.execute(
        trx,
      );
      opsFolded += folded.length;
    }
    // Entries a device can no longer retry (it has pushed past them) are no longer needed.
    const pruned = await sql`delete from compacted_ops c using devices d
      where c.device = d.device_id and c.op_seq < d.push_floor`.execute(trx);
    metrics?.compactedOps.inc(opsFolded);
    return {
      watermark: Number(watermark),
      records: candidates.length,
      opsFolded,
      tombstonesPruned: Number(pruned.numAffectedRows ?? 0),
    };
  });
}
