import { type Kysely, sql } from 'kysely';

// Concurrent pushes (ADR-0010). Feed rows get `pos`, their position in delivery order: the id of
// the transaction that wrote them, shifted past every `seq` written before this migration. Pulls
// read only rows from transactions older than every transaction still running, so a slow commit can
// never be skipped, without making pushes wait for each other.
export async function up(db: Kysely<unknown>): Promise<void> {
  const { rows } = await sql<{
    next: string;
  }>`select coalesce(max(seq), 0) + 1 as next from feed`.execute(db);
  const offset = BigInt(rows[0]!.next);
  // A constant, so the column default and every query agree on it forever.
  await sql
    .raw(
      `create function accord_xid_offset() returns bigint language sql immutable as $$ select ${offset}::bigint $$`,
    )
    .execute(db);
  await sql`create function accord_pos() returns bigint language sql volatile as $$
      select pg_current_xact_id()::text::bigint + accord_xid_offset() $$`.execute(db);
  await sql`create function accord_horizon() returns bigint language sql volatile as $$
      select pg_snapshot_xmin(pg_current_snapshot())::text::bigint + accord_xid_offset() $$`.execute(
    db,
  );

  await sql`alter table feed add column pos bigint`.execute(db);
  await sql`select set_config('accord.compaction', 'on', true)`.execute(db);
  await sql`alter table feed disable trigger accord_feed_append_only`.execute(db);
  await sql`update feed set pos = seq`.execute(db);
  await sql`alter table feed enable trigger accord_feed_append_only`.execute(db);
  await sql`alter table feed alter column pos set not null`.execute(db);
  await sql`alter table feed alter column pos set default accord_pos()`.execute(db);
  await db.schema.createIndex('feed_pos_seq').on('feed').columns(['pos', 'seq']).execute();

  // Cursors were feed `seq` values; they now count in `pos`. Every device starts again from zero.
  await sql`update devices set cursor = 0, needs_resync = true`.execute(db);
  // The lowest op number in a device's latest push: it has its answers for every op below it, so
  // compacted-op entries below it can be forgotten (ADR-0010).
  await sql`alter table devices add column push_floor bigint not null default 0`.execute(db);
  // The highest op number applied from each device: a reinstalled device that lost its local
  // counter learns it on its next pull, and an op id at or below it is never applied twice.
  await sql`alter table devices add column max_op_seq bigint not null default 0`.execute(db);
  await sql`update devices d set max_op_seq = coalesce((select max(split_part(op_id, ':', 2)::bigint)
      from feed f where f.kind = 'op' and split_part(f.op_id, ':', 1) = d.device_id), 0)`.execute(
    db,
  );

  await sql`alter table compacted_ops add column device text`.execute(db);
  await sql`alter table compacted_ops add column op_seq bigint`.execute(db);
  await sql`update compacted_ops set device = split_part(op_id, ':', 1), op_seq = split_part(op_id, ':', 2)::bigint`.execute(
    db,
  );
  await sql`alter table compacted_ops alter column device set not null`.execute(db);
  await sql`alter table compacted_ops alter column op_seq set not null`.execute(db);
  await db.schema
    .createIndex('compacted_ops_device')
    .on('compacted_ops')
    .columns(['device', 'op_seq'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('compacted_ops').dropColumn('device').dropColumn('op_seq').execute();
  await db.schema.alterTable('devices').dropColumn('push_floor').dropColumn('max_op_seq').execute();
  await sql`alter table feed drop column pos`.execute(db);
  await sql`drop function accord_horizon()`.execute(db);
  await sql`drop function accord_pos()`.execute(db);
  await sql`drop function accord_xid_offset()`.execute(db);
}
