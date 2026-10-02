import { type Kysely, sql } from 'kysely';

// Migrations are append-only: never edit one that has shipped, add a new one.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('accord_meta')
    .addColumn('key', 'text', (c) => c.primaryKey())
    .addColumn('value', 'text', (c) => c.notNull())
    .execute();
  await sql`insert into accord_meta (key, value) values ('schema_created_at', now()::text)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('accord_meta').execute();
}
