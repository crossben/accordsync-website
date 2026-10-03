import { type Migration, Migrator } from 'kysely/migration';
import type { Db } from './db';
import * as m0001 from './migrations/0001_meta';
import * as m0002 from './migrations/0002_sync';
import * as m0003 from './migrations/0003_compaction';
import * as m0004 from './migrations/0004_record_state';
import * as m0005 from './migrations/0005_concurrent_pushes';

// Listed explicitly (not read from disk) so the bundled server carries its migrations.
const migrations: Record<string, Migration> = {
  '0001_meta': m0001,
  '0002_sync': m0002,
  '0003_compaction': m0003,
  '0004_record_state': m0004,
  '0005_concurrent_pushes': m0005,
};

export async function migrateToLatest(db: Db): Promise<void> {
  return migrateTo(db);
}

/** Migrates up to `target` (a migration name), or to the latest when omitted. For upgrade tests. */
export async function migrateTo(db: Db, target?: string): Promise<void> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
  const { error, results } = target
    ? await migrator.migrateTo(target)
    : await migrator.migrateToLatest();
  for (const r of results ?? []) {
    if (r.status === 'Error') console.error(`migration ${r.migrationName} failed`);
  }
  if (error) throw error;
}
