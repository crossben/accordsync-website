/**
 * End to end: real clients, the real server, real PostgreSQL. HTTP requests go through the
 * server's request handler in-process, so no port is opened.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compact, createApp, createDb, defineServer, migrateToLatest } from '@accordsync/server';
import { createRng } from '@accordsync/simulator';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { SignJWT } from 'jose';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AccordClient,
  conflict,
  counter,
  defineSchema,
  httpTransport,
  lww,
  MemoryStorage,
  type Refusal,
  set,
  SqliteStorage,
  type StorageAdapter,
} from '../src/index';
import { nodeSqlite } from './sqlite-driver';

const SECRET = 'e2e-secret-at-least-32-bytes-long!!!';
const schema = defineSchema({
  dossier: {
    agent: lww(),
    zone: lww(),
    client_name: lww(),
    status: conflict(),
    visits: counter(),
    docs: set(),
  },
});
const def = defineServer({
  schema,
  scopes: {
    dossier: (r) =>
      [
        typeof r.fields.agent === 'string' ? `agent:${r.fields.agent}` : null,
        typeof r.fields.zone === 'string' ? `zone:${r.fields.zone}` : null,
      ].filter((k): k is string => k !== null),
  },
  access: (claims) => {
    const zones = Array.isArray(claims.zones) ? claims.zones.map(String) : [];
    return {
      read: [`agent:${claims.sub}`, ...zones.map((z) => `zone:${z}`)],
      write: [`agent:${claims.sub}`, ...zones.map((z) => `zone:${z}`)],
    };
  },
  auth: { hs256Secret: SECRET },
  compaction: { minOps: 2 },
});

const sign = (sub: string, zones: string[]) =>
  new SignJWT({ zones })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));

describe('clients and server, end to end', () => {
  let container: StartedPostgreSqlContainer;
  let db: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createApp>;
  const tokens = new Map<string, string>();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    db = createDb(container.getConnectionUri());
    await migrateToLatest(db);
    app = createApp({ db, def });
  }, 120_000);
  afterAll(async () => {
    await db?.destroy();
    await container?.stop();
  });
  beforeEach(async () => {
    await sql`truncate feed, records, devices, compacted_ops restart identity`.execute(db);
    tokens.set('awa', await sign('awa', ['dakar']));
    tokens.set('moussa', await sign('moussa', ['dakar']));
    tokens.set('fatou', await sign('fatou', ['thies']));
  });

  const open = (
    user: string,
    deviceId: string,
    storage: StorageAdapter = new MemoryStorage(),
    extra = {},
  ) =>
    AccordClient.open({
      schema,
      storage,
      deviceId,
      transport: httpTransport({
        url: 'http://accord.test',
        getToken: () => tokens.get(user)!,
        fetch: (input, init) => Promise.resolve(app.request(String(input), init)),
      }),
      ...extra,
    });

  const syncAll = async (...cs: AccordClient[]) => {
    for (let i = 0; i < 2; i++) for (const c of cs) await c.sync();
  };

  it('two agents edit offline, then converge', async () => {
    const awa = await open('awa', 'awa-phone');
    const moussa = await open('moussa', 'moussa-phone');
    await awa.assign('dossier:1', 'zone', 'dakar');
    await awa.assign('dossier:1', 'agent', 'awa');
    await awa.sync();
    await moussa.sync();

    // Both offline: no sync while they work.
    await awa.inc('dossier:1', 'visits', 2);
    await awa.add('dossier:1', 'docs', 'cni.pdf');
    await moussa.inc('dossier:1', 'visits', 3);
    await moussa.assign('dossier:1', 'client_name', 'Aminata Fall');

    await syncAll(awa, moussa);
    for (const c of [awa, moussa]) {
      expect(c.read('dossier:1')).toEqual({
        agent: 'awa',
        zone: 'dakar',
        client_name: 'Aminata Fall',
        status: undefined,
        visits: 5,
        docs: ['cni.pdf'],
      });
      expect(c.status().pending).toBe(0);
    }
  });

  it('surfaces a conflict on both devices, and a resolution clears it everywhere', async () => {
    const awa = await open('awa', 'awa-phone');
    const moussa = await open('moussa', 'moussa-phone');
    await awa.assign('dossier:1', 'zone', 'dakar');
    await syncAll(awa, moussa);

    await awa.assign('dossier:1', 'status', 'approved');
    await moussa.assign('dossier:1', 'status', 'rejected');
    await syncAll(awa, moussa);
    for (const c of [awa, moussa]) {
      expect(c.conflicts()).toEqual([
        {
          record: 'dossier:1',
          field: 'status',
          values: [
            { value: 'approved', opId: 'awa-phone:2' },
            { value: 'rejected', opId: 'moussa-phone:1' },
          ],
        },
      ]);
    }

    await moussa.resolve('dossier:1', 'status', 'approved');
    await syncAll(awa, moussa);
    for (const c of [awa, moussa]) {
      expect(c.conflicts()).toEqual([]);
      expect(c.read('dossier:1')?.status).toEqual({ value: 'approved' });
    }
  });

  it('a refused write is rolled back locally and reported', async () => {
    const fatou = await open('fatou', 'fatou-phone');
    const awa = await open('awa', 'awa-phone');
    await fatou.assign('dossier:7', 'zone', 'thies');
    await fatou.sync();

    // Awa cannot see dossier:7, but tries to create something in Fatou's zone.
    const refusals: Refusal[] = [];
    awa.on('refused', (r) => refusals.push(r));
    await awa.assign('dossier:7', 'client_name', 'not mine');
    expect(awa.read('dossier:7')?.client_name).toBe('not mine'); // local-first: visible at once
    await awa.sync();
    expect(refusals).toEqual([
      {
        opId: 'awa-phone:1',
        record: 'dossier:7',
        field: 'client_name',
        reason: 'out of scope: you may not write dossier:7',
      },
    ]);
    expect(awa.read('dossier:7')).toBeUndefined();
    expect(awa.status().pending).toBe(0);
  });

  it('a record reassigned away is removed from the device', async () => {
    const awa = await open('awa', 'awa-phone');
    const fatou = await open('fatou', 'fatou-phone');
    await awa.assign('dossier:3', 'agent', 'awa');
    await awa.inc('dossier:3', 'visits', 4);
    await awa.sync();

    await awa.assign('dossier:3', 'agent', 'fatou');
    const changed: string[][] = [];
    awa.on('change', (e) => changed.push(e.records));
    await awa.sync();
    expect(awa.read('dossier:3')).toBeUndefined();
    expect(changed).toContainEqual(['dossier:3']);

    await fatou.sync();
    expect(fatou.read('dossier:3')).toMatchObject({ agent: 'fatou', visits: 4 });
  });

  it('resyncs when read scopes change, keeping unpushed edits', async () => {
    const fatou = await open('fatou', 'fatou-phone');
    await fatou.assign('dossier:8', 'zone', 'thies');
    await fatou.sync();
    const awa = await open('awa', 'awa-phone');
    await awa.assign('dossier:1', 'zone', 'dakar');
    await awa.sync();
    expect(awa.records()).toEqual(['dossier:1']);

    // Awa moves to the Thiès zone too; she keeps working before her next sync.
    tokens.set('awa', await sign('awa', ['dakar', 'thies']));
    await awa.inc('dossier:8', 'visits', 1);
    let resyncs = 0;
    awa.on('resync', () => resyncs++);
    await awa.sync();
    expect(resyncs).toBe(1);
    expect(awa.records()).toEqual(['dossier:1', 'dossier:8']);
    expect(awa.read('dossier:8')).toMatchObject({ zone: 'thies', visits: 1 });
    await fatou.sync();
    expect(fatou.read('dossier:8')?.visits).toBe(1);
  });

  it('survives a restart: data, outbox, cursor and op numbering are kept', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'accord-e2e-')), 'device.db');
    const first = await open('awa', 'ignored', new SqliteStorage(nodeSqlite(file)), {
      deviceId: 'awa-tablet',
    });
    await first.assign('dossier:1', 'zone', 'dakar');
    await first.sync();
    await first.inc('dossier:1', 'visits', 1); // offline, then the app is killed
    await first.close();

    const again = await open('awa', 'other-id', new SqliteStorage(nodeSqlite(file)));
    expect(again.deviceId).toBe('awa-tablet');
    expect(again.status()).toMatchObject({ pending: 1, cursor: 2 });
    expect(again.read('dossier:1')?.visits).toBe(1);
    const next = await again.inc('dossier:1', 'visits', 1);
    expect(next.opId).toBe('awa-tablet:3'); // never reuses an op id
    await again.sync();
    expect(again.status().pending).toBe(0);
  });

  it('writes made during a sync round are not lost', async () => {
    const awa = await open('awa', 'awa-phone');
    await awa.assign('dossier:1', 'zone', 'dakar');
    const round = awa.sync();
    await awa.inc('dossier:1', 'visits', 1);
    await round;
    await awa.sync();
    const other = await open('awa', 'awa-laptop');
    await other.sync();
    expect(other.read('dossier:1')?.visits).toBe(1);
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`random work by three devices converges through the real server (seed ${seed})`, async () => {
      const rng = createRng(seed);
      const devices = [
        await open('awa', 'awa-1'),
        await open('awa', 'awa-2'),
        await open('moussa', 'moussa-1'),
      ];
      await devices[0]!.assign('dossier:1', 'zone', 'dakar');
      await devices[0]!.assign('dossier:2', 'zone', 'dakar');
      await syncAll(...devices);
      for (let step = 0; step < 80; step++) {
        const d = devices[rng.int(0, devices.length - 1)]!;
        const record = `dossier:${rng.int(1, 2)}`;
        switch (rng.int(0, 5)) {
          case 0:
            await d.inc(record, 'visits', rng.int(-2, 5));
            break;
          case 1:
            await d.add(record, 'docs', `doc-${rng.int(0, 3)}`);
            break;
          case 2:
            await d.remove(record, 'docs', `doc-${rng.int(0, 3)}`);
            break;
          case 3:
            await d.assign(record, 'status', `s${rng.int(0, 2)}`);
            break;
          case 4:
            await d.assign(record, 'client_name', `n${rng.int(0, 9)}`);
            break;
          default:
            await d.sync(); // devices sync at random moments, otherwise they are offline
        }
      }
      await syncAll(...devices);
      const states = devices.map((d) =>
        JSON.stringify(['dossier:1', 'dossier:2'].map((r) => d.read(r))),
      );
      expect(new Set(states).size).toBe(1);
    }, 60_000);
  }

  it('after compaction, a new device gets the snapshot, keeps it across a restart, and merges on top', async () => {
    const awa = await open('awa', 'awa-phone');
    await awa.assign('dossier:1', 'zone', 'dakar');
    for (let i = 0; i < 4; i++) await awa.inc('dossier:1', 'visits', 1);
    await awa.add('dossier:1', 'docs', 'a.pdf');
    await awa.remove('dossier:1', 'docs', 'a.pdf');
    await awa.assign('dossier:1', 'status', 'submitted');
    await syncAll(awa);
    await awa.sync(); // the server now knows Awa has everything
    expect((await compact(db, def)).records).toBe(1);

    const file = join(mkdtempSync(join(tmpdir(), 'accord-compact-')), 'd.db');
    const tablet = await open('awa', 'awa-tablet', new SqliteStorage(nodeSqlite(file)));
    await tablet.inc('dossier:1', 'visits', 10); // a blind offline write to a record it has never seen
    await tablet.sync();
    expect(tablet.read('dossier:1')).toEqual({ ...awa.read('dossier:1'), visits: 14 });
    await tablet.close();

    const again = await open('awa', 'x', new SqliteStorage(nodeSqlite(file)));
    expect(again.read('dossier:1')).toMatchObject({
      zone: 'dakar',
      visits: 14,
      docs: [],
      status: { value: 'submitted' },
    });
    await awa.sync();
    expect(awa.read('dossier:1')?.visits).toBe(14);
  });

  it('syncs in the background, and backs off while the server is unreachable', async () => {
    let down = 2;
    const errors: unknown[] = [];
    const awa = await AccordClient.open({
      schema,
      storage: new MemoryStorage(),
      deviceId: 'awa-bg',
      transport: httpTransport({
        url: 'http://accord.test',
        getToken: () => tokens.get('awa')!,
        fetch: (input, init) =>
          down-- > 0
            ? Promise.reject(new TypeError('network down'))
            : Promise.resolve(app.request(String(input), init)),
      }),
      minBackoffMs: 10,
      maxBackoffMs: 40,
      syncIntervalMs: 20,
    });
    awa.on('error', (e) => errors.push(e.error));
    const synced = new Promise<void>((resolve) => awa.on('synced', () => resolve()));
    await awa.assign('dossier:1', 'zone', 'dakar');
    awa.start();
    await synced;
    awa.stop();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(awa.status()).toMatchObject({ pending: 0, lastError: undefined });
  });
});
