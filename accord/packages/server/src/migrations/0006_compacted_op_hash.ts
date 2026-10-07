import type { Kysely } from 'kysely';

// The content of each folded op, as a hash: a retried push of a compacted op is acknowledged only
// if it is the same op. Another op reusing the id (a device that lost its storage) is refused
// instead of silently dropped (ADR-0010). Rows folded before this migration have no hash and keep
// the old behaviour.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('compacted_ops').addColumn('op_hash', 'text').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('compacted_ops').dropColumn('op_hash').execute();
}
