import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // The feed can now hold snapshots: a record's state with its older ops folded away (ADR-0008).
  await sql`alter table feed drop constraint feed_kind_check`.execute(db);
  await sql`alter table feed drop constraint feed_shape`.execute(db);
  await sql`alter table feed add constraint feed_kind_check check (kind in ('op', 'scope', 'snapshot'))`.execute(
    db,
  );
  await sql`alter table feed add constraint feed_shape check (
       (kind = 'op' and op_id is not null and op is not null and scopes_before is null)
    or (kind = 'scope' and op_id is null and op is null and scopes_before is not null)
    or (kind = 'snapshot' and op_id is null and op is not null and scopes_before is null))`.execute(
    db,
  );

  // Ids of ops folded into snapshots: a retried push of one is acknowledged, never applied twice.
  await db.schema
    .createTable('compacted_ops')
    .addColumn('op_id', 'text', (c) => c.primaryKey())
    .execute();

  await db.schema
    .alterTable('devices')
    // Feed position the device has applied (the cursor it last pulled from): compaction waits for it.
    .addColumn('cursor', 'bigint', (c) => c.notNull().defaultTo(0))
    // Set when a device comes back after the retirement TTL: its next pull must start from zero.
    .addColumn('needs_resync', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('devices').dropColumn('cursor').dropColumn('needs_resync').execute();
  await db.schema.dropTable('compacted_ops').execute();
}
