import type { RecordSnapshot, WireOp } from '@accordsync/core';
import { type ColumnType, type Generated, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/** Table types grow with each migration. */
export interface Database {
  accord_meta: { key: string; value: string };
  feed: {
    // bigint comes back from pg as a string
    seq: ColumnType<string, never, never>;
    /** Delivery order: the writing transaction's id, shifted (migration 0005). Set by default. */
    pos: ColumnType<string, string | undefined, never>;
    kind: 'op' | 'scope' | 'snapshot';
    record: string;
    op_id: string | null;
    /** The op (kind 'op') or the RecordSnapshot (kind 'snapshot'). */
    op: WireOp | RecordSnapshot | null;
    scopes: string[];
    scopes_before: string[] | null;
  };
  /** `state` is null for records written before migration 0004 (rebuilt from the feed). */
  records: { record: string; scopes: string[]; state: RecordSnapshot | null };
  compacted_ops: { op_id: string; device: string; op_seq: string; op_hash: string | null };
  devices: {
    device_id: string;
    sub: string;
    read_keys: string[] | null;
    /** A scope delta not yet received: the read keys before it (migration 0007). */
    delta_keys: ColumnType<string[] | null, never, string[] | null>;
    /** The cursor that delta was pulled from; a pull above it shows it was received. */
    delta_cursor: ColumnType<string | null, never, string | number | null>;
    cursor: ColumnType<string, never, string>;
    needs_resync: Generated<boolean>;
    push_floor: ColumnType<string, never, string>;
    max_op_seq: ColumnType<string, never, string>;
    first_seen: Generated<Date>;
    last_seen: Generated<Date>;
  };
}

export type Db = Kysely<Database>;

export function createDb(databaseUrl: string, poolSize = 20): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: databaseUrl, max: poolSize }),
    }),
  });
}
