import type { Kysely } from 'kysely';

// Each record's current state, kept up to date by every push, so a push reads one row instead of
// the record's whole history (ADR-0008 explains why a state without tombstones is enough).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('records').addColumn('state', 'jsonb').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('records').dropColumn('state').execute();
}
