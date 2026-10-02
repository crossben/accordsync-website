import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // The feed: every accepted op and every scope change, in one global order. `seq` is the cursor.
  await db.schema
    .createTable('feed')
    .addColumn('seq', 'bigserial', (c) => c.primaryKey())
    .addColumn('kind', 'text', (c) => c.notNull().check(sql`kind in ('op', 'scope')`))
    .addColumn('record', 'text', (c) => c.notNull())
    .addColumn('op_id', 'text', (c) => c.unique())
    .addColumn('op', 'jsonb')
    // For an op: the record's scope keys after applying it. For a scope change: the new keys.
    .addColumn('scopes', sql`text[]`, (c) => c.notNull())
    .addColumn('scopes_before', sql`text[]`)
    .addCheckConstraint(
      'feed_shape',
      sql`(kind = 'op' and op_id is not null and op is not null and scopes_before is null)
       or (kind = 'scope' and op_id is null and op is null and scopes_before is not null)`,
    )
    .execute();
  await db.schema.createIndex('feed_record_seq').on('feed').columns(['record', 'seq']).execute();
  await db.schema.createIndex('feed_scopes').on('feed').using('gin').column('scopes').execute();

  // The log is append-only: Postgres itself refuses edits. Deletes are allowed only to compaction,
  // which sets accord.compaction = 'on' in its own transaction.
  await sql`
    create function accord_feed_guard() returns trigger language plpgsql as $$
    begin
      if tg_op = 'DELETE' and current_setting('accord.compaction', true) = 'on' then
        return old;
      end if;
      raise exception 'accord: the feed is append-only (% refused)', tg_op;
    end $$`.execute(db);
  await sql`
    create trigger accord_feed_append_only before update or delete on feed
    for each row execute function accord_feed_guard()`.execute(db);

  await db.schema
    .createTable('records')
    .addColumn('record', 'text', (c) => c.primaryKey())
    .addColumn('scopes', sql`text[]`, (c) => c.notNull())
    .execute();

  await db.schema
    .createTable('devices')
    .addColumn('device_id', 'text', (c) => c.primaryKey())
    .addColumn('sub', 'text', (c) => c.notNull())
    // Read keys the device last did a full pull with; a change forces a resync.
    .addColumn('read_keys', sql`text[]`)
    .addColumn('first_seen', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('last_seen', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('devices').execute();
  await db.schema.dropTable('records').execute();
  await db.schema.dropTable('feed').execute();
  await sql`drop function accord_feed_guard()`.execute(db);
}
