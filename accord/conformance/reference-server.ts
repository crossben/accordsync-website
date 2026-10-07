/**
 * The reference implementation of the conformance profile: @accordsync/server (this workspace's
 * sources) configured as `profile.json` says, plus the test-only control API on a second port.
 * Other servers (PHP, Python) implement the same two ports; see PROFILE.md. Never expose the
 * control port outside a test environment.
 *
 *   ACCORD_DATABASE_URL=postgres://… ACCORD_PORT=8787 ACCORD_CONTROL_PORT=8788 pnpm reference
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { serve } from '@hono/node-server';
import {
  compact,
  conflict,
  counter,
  createApp,
  createDb,
  defineSchema,
  defineServer,
  lww,
  migrateToLatest,
  set,
} from '@accordsync/server';
import { SignJWT } from 'jose';
import { sql } from 'kysely';
import profile from './profile.json' with { type: 'json' };

const databaseUrl = process.env.ACCORD_DATABASE_URL;
if (!databaseUrl) throw new Error('ACCORD_DATABASE_URL is required');
const port = Number(process.env.ACCORD_PORT ?? 8787);
const controlPort = Number(process.env.ACCORD_CONTROL_PORT ?? 8788);

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const key = (prefix: string, v: unknown): string[] =>
  typeof v === 'string' ? [`${prefix}:${v}`] : [];

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
  scopes: { dossier: (r) => [...key('agent', r.fields.agent), ...key('zone', r.fields.zone)] },
  access: (claims) => {
    const write = [`agent:${claims.sub}`, ...strings(claims.zones).map((z) => `zone:${z}`)];
    const readonly = strings(claims.readonly_zones).map((z) => `zone:${z}`);
    return { read: [...write, ...readonly], write };
  },
  auth: { ...profile.auth },
  limits: { ...profile.limits },
  rateLimit: profile.rateLimit,
  compaction: profile.compaction,
});

const db = createDb(databaseUrl);
await migrateToLatest(db);

// Recreated on reset, so rate-limit buckets start full again.
let app = createApp({ db, def });
serve({ fetch: (req) => app.fetch(req), port });

const secret = new TextEncoder().encode(profile.auth.hs256Secret);

async function control(url: URL, method: string): Promise<unknown> {
  const q = url.searchParams;
  if (method === 'GET' && url.pathname === '/token') {
    const sub = q.get('sub');
    if (!sub) throw new HttpError(400, 'sub is required');
    const claims: Record<string, unknown> = {};
    if (q.has('zone')) claims.zones = q.getAll('zone');
    if (q.has('readonly_zone')) claims.readonly_zones = q.getAll('readonly_zone');
    const exp = Math.floor(Date.now() / 1000) + Number(q.get('exp_in') ?? 3600);
    return {
      token: await new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(sub)
        .setIssuer(profile.auth.issuer)
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secret),
    };
  }
  if (method === 'POST' && url.pathname === '/reset') {
    await release();
    await sql`truncate feed, records, devices, compacted_ops restart identity`.execute(db);
    app = createApp({ db, def });
    return {};
  }
  if (method === 'POST' && url.pathname === '/compact') {
    return compact(db, def);
  }
  if (method === 'POST' && url.pathname === '/age-device') {
    const device = q.get('device');
    const days = Number(q.get('days'));
    if (!device || !Number.isFinite(days)) throw new HttpError(400, 'device and days are required');
    const r = await sql`update devices set last_seen = now() - make_interval(days => ${days})
      where device_id = ${device}`.execute(db);
    if (Number(r.numAffectedRows ?? 0) === 0) throw new HttpError(404, 'unknown device');
    return {};
  }
  if (method === 'POST' && url.pathname === '/hold-record') {
    const record = q.get('record');
    if (!record) throw new HttpError(400, 'record is required');
    if (hold) throw new HttpError(409, 'a record is already held');
    return holdRecord(record);
  }
  if (method === 'GET' && url.pathname === '/held') {
    if (!hold) return { waiting: 0 };
    const r = await sql<{ n: string }>`select count(*) as n from pg_stat_activity
      where ${hold.pid}::int = any(pg_blocking_pids(pid))`.execute(db);
    return { waiting: Number(r.rows[0]!.n) };
  }
  if (method === 'POST' && url.pathname === '/release') {
    await release();
    return {};
  }
  throw new HttpError(404, 'not found');
}

/** The record lock held by `/hold-record`: its session's pid, and how to end it. */
let hold: { pid: number; release: () => void; done: Promise<void> } | undefined;

function holdRecord(record: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const done = db
      .connection()
      .execute(async (conn) => {
        await sql`begin`.execute(conn);
        try {
          const row =
            await sql`select record from records where record = ${record} for update`.execute(conn);
          if (row.rows.length === 0) throw new HttpError(404, 'unknown record');
          const pid = (await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(conn))
            .rows[0]!.pid;
          let release!: () => void;
          const released = new Promise<void>((r) => (release = r));
          hold = { pid, release, done };
          resolve({});
          await released;
        } finally {
          await sql`rollback`.execute(conn);
        }
      })
      .catch((e: unknown) => {
        hold = undefined;
        reject(e);
      });
  });
}

async function release(): Promise<void> {
  const h = hold;
  if (!h) return;
  h.release();
  await h.done;
  hold = undefined;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://control');
  control(url, req.method ?? 'GET').then(
    (body) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body)),
    (e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res
        .writeHead(status, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: String((e as Error).message ?? e) }));
    },
  );
}).listen(controlPort, () =>
  console.log(`accord reference server on :${port}, control API on :${controlPort}`),
);
