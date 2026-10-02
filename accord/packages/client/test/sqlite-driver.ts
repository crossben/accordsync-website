import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver } from '../src/storage/sqlite';

/** A SqlDriver over Node's built-in SQLite: the same few lines an app writes for its library. */
export function nodeSqlite(path = ':memory:'): SqlDriver & { db: DatabaseSync } {
  const db = new DatabaseSync(path);
  return {
    db,
    run: (sql, params = []) => {
      db.prepare(sql).run(...(params as never[]));
    },
    all: <T>(sql: string, params: readonly unknown[] = []) =>
      db.prepare(sql).all(...(params as never[])) as T[],
  };
}
