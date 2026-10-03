import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createDb, type Db } from '../src/db';
import { migrateTo } from '../src/migrate';
import { def, TestDevice, token } from './harness';

describe('upgrading a v0.1 database to concurrent pushes (migration 0005)', () => {
  let container: StartedPostgreSqlContainer;
  let db: Db;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = createDb(container.getConnectionUri());
  }, 120_000);
  afterAll(async () => {
    await db?.destroy();
    await container?.stop();
  });

  it('keeps old history first, sends every device back to zero, and keeps syncing', async () => {
    await migrateTo(db, '0004_record_state');
    // v0.1 data, as the v0.1 schema stored it: a device that has pulled everything.
    await sql`insert into feed (kind, record, op_id, op, scopes) values
      ('op', 'dossier:1', 'alice-phone:1', ${JSON.stringify({ op_id: 'alice-phone:1', record: 'dossier:1', field: 'agent', kind: 'assign', value: 'alice', deps: [], hlc: '1000:00000:alice-phone' })}::jsonb, '{agent:alice}'),
      ('op', 'dossier:1', 'alice-phone:2', ${JSON.stringify({ op_id: 'alice-phone:2', record: 'dossier:1', field: 'visits', kind: 'inc', by: 4, hlc: '1001:00000:alice-phone' })}::jsonb, '{agent:alice}')`.execute(
      db,
    );
    await sql`insert into records (record, scopes) values ('dossier:1', '{agent:alice}')`.execute(
      db,
    );
    await sql`insert into devices (device_id, sub, read_keys, cursor) values ('alice-phone', 'alice', '{agent:alice}', 2)`.execute(
      db,
    );
    await sql`insert into compacted_ops (op_id) values ('alice-phone:0')`
      .execute(db)
      .catch(() => undefined);

    await migrateTo(db);

    const feed = (
      await sql<{ seq: string; pos: string }>`select seq, pos from feed order by seq`.execute(db)
    ).rows;
    expect(feed.map((r) => r.pos)).toEqual(feed.map((r) => r.seq)); // old rows keep their order
    const device = (
      await sql<{
        cursor: string;
        needs_resync: boolean;
      }>`select cursor, needs_resync from devices`.execute(db)
    ).rows[0]!;
    expect(device).toEqual({ cursor: '0', needs_resync: true });

    const h = {
      db,
      url: container.getConnectionUri(),
      app: createApp({ db, def }),
      reset: async () => {},
      stop: async () => {},
    };
    const phone = new TestDevice(h, 'alice-phone', await token('alice'));
    phone.cursor = 2; // its v0.1 cursor
    expect(await phone.pull()).toEqual({ resync_required: true });
    phone.cursor = 0;
    await phone.pullAll();
    await phone.push([phone.writer.inc('dossier:1', 'visits', 1)]);
    await phone.pullAll();
    expect(phone.writer.replica.read('dossier:1')).toMatchObject({ agent: 'alice', visits: 5 });
    expect(phone.writer.replica.ops().map((o) => o.opId)).toContain('alice-phone:3'); // never reused
    const newPos = (await sql<{ pos: string }>`select max(pos) as pos from feed`.execute(db))
      .rows[0]!.pos;
    expect(BigInt(newPos)).toBeGreaterThan(2n); // new rows come after every old one
  });
});
