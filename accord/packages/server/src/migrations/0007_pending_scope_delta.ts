import { type Kysely, sql } from 'kysely';

// A scope delta stays pending until the device shows it received it (ADR-0011, update of
// 2026-10-07). `delta_keys` are the device's read keys before the delta, `delta_cursor` the cursor
// the delta was pulled from: a pull at or below it is a retry of a lost answer and gets the delta
// again; a pull above it clears both.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table devices add column delta_keys text[], add column delta_cursor bigint`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table devices drop column delta_keys, drop column delta_cursor`.execute(db);
}
