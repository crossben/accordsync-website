import type { RecordSnapshot, WireOp } from '@accordsync/core';
import { type ColumnType, type Generated, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/** Table types grow with each migration. */
export interface Database {
  accord_meta: { key: string; value: string };
  feed: {
    // bigint comes back from pg as a string
    seq: ColumnType<string, never, never>;
    kind: 'op' | 'scope' | 'snapshot';
    record: string;
    op_id: string | null;
    /** The op (kind 'op') or the RecordSnapshot (kind 'snapshot'). */
    op: WireOp | RecordSnapshot | null;
    scopes: string[];
    scopes_before: string[] | null;
  };
  records: { record: string; scopes: string[] };
  compacted_ops: { op_id: string };
  devices: {
    device_id: string;
    sub: string;
    read_keys: string[] | null;
    cursor: ColumnType<string, never, string>;
    needs_resync: Generated<boolean>;
    first_seen: Generated<Date>;
    last_seen: Generated<Date>;
  };
}

export type Db = Kysely<Database>;

export function createDb(databaseUrl: string): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: databaseUrl }) }),
  });
}
