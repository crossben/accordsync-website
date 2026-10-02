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
    await sql`select pg_advisory_xact_lock(${FEED_LOCK})`.execute(trx);
    await sql`select set_config('accord.compaction', 'on', true)`.execute(trx);

    const { watermark } = await trx
      .selectFrom('feed')
      .select(
        sql<string>`coalesce(
          (select min(cursor) from devices where last_seen > now() - make_interval(secs => ${ttlSecs})),
          (select max(seq) from feed),
          0)`.as('watermark'),
      )
      .executeTakeFirstOrThrow();

    const candidates = await trx
      .selectFrom('feed')
      .select(['record', sql<string>`max(seq)`.as('last')])
      .where('kind', 'in', ['op', 'snapshot'])
      .groupBy('record')
      .having(sql<string>`max(seq)`, '<=', watermark as never)
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
        .values(folded.map((op_id) => ({ op_id })))
        .onConflict((oc) => oc.doNothing())
        .execute();
      await trx
        .deleteFrom('feed')
        .where('record', '=', record)
        .where('seq', '<=', last as never)
        .execute();
      await sql`insert into feed (seq, kind, record, op, scopes)
        values (${last}, 'snapshot', ${record}, ${JSON.stringify(replica.snapshotRecord(record))}::jsonb, ${scopes}::text[])`.execute(
        trx,
      );
      opsFolded += folded.length;
    }
    metrics?.compactedOps.inc(opsFolded);
    return { watermark: Number(watermark), records: candidates.length, opsFolded };
  });
}
