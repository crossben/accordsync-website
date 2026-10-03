#!/usr/bin/env node
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { compact } from './compact';
import { loadConfig } from './config';
import { createDb } from './db';
import { createMetrics } from './metrics';
import type { ServerDefinition } from './define';
import { migrateToLatest } from './migrate';

const USAGE = `Usage: accord serve   [--config ./accord.config.ts]   run the sync server
       accord compact [--config ./accord.config.ts]   fold old history once, then exit

Environment:
  ACCORD_DATABASE_URL  PostgreSQL connection string (required)
  ACCORD_PORT          HTTP port (default 8080)
  ACCORD_DB_POOL       PostgreSQL connections per process (default 20)
  ACCORD_WORKERS       server processes sharing the port: a number or "auto" (default 1)`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { config: { type: 'string', default: 'accord.config.ts' }, help: { type: 'boolean' } },
});

const command = positionals[0];
if (values.help || (command !== 'serve' && command !== 'compact')) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

const file = resolve(values.config);
const mod = (await import(pathToFileURL(file).href)) as { default?: ServerDefinition };
if (!mod.default) throw new Error(`${file} must export default defineServer({...})`);

const def = mod.default;
if (!def.auth.issuer || !def.auth.audience) {
  console.warn(
    'accord: auth has no issuer or audience: any token signed by the same key is accepted. Set both in production.',
  );
}
if ('hs256Secret' in def.auth) {
  console.warn('accord: using a shared HS256 secret (development). Use jwksUrl in production.');
}
const config = loadConfig();
const workers =
  process.env.ACCORD_WORKERS === 'auto'
    ? availableParallelism()
    : Number(process.env.ACCORD_WORKERS ?? 1);
if (!Number.isInteger(workers) || workers < 1) {
  throw new Error(
    `ACCORD_WORKERS must be a positive integer or "auto", got "${process.env.ACCORD_WORKERS}"`,
  );
}
// With several workers, the primary migrates and compacts; the workers serve. Pushes from different
// workers run concurrently, like pushes within one (ADR-0010). Metrics and rate limits are per worker.
const isWorker = cluster.isWorker;
const primaryOfMany = command === 'serve' && workers > 1 && cluster.isPrimary;
const db = createDb(config.databaseUrl, config.dbPoolSize);
if (!isWorker) await migrateToLatest(db);
const metrics = createMetrics(db, def);

const runCompaction = async () => {
  const started = Date.now();
  const r = await compact(db, def, metrics);
  console.log(
    `compaction: ${r.records} records, ${r.opsFolded} ops folded below position ${r.watermark}, ${r.tombstonesPruned} tombstones pruned (${Date.now() - started} ms)`,
  );
};

if (command === 'compact') {
  await runCompaction();
  await db.destroy();
  process.exit(0);
}

const every = def.compaction?.intervalMs ?? 3_600_000;
const timer =
  every > 0 && !isWorker
    ? setInterval(
        () => void runCompaction().catch((e: unknown) => console.error('compaction failed', e)),
        every,
      )
    : undefined;
timer?.unref();

let shutdown: () => void;
if (primaryOfMany) {
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    if (code !== 0) {
      console.error(`accord: worker ${worker.process.pid} exited (${code}); starting another`);
      cluster.fork();
    }
  });
  console.log(`accord: ${workers} workers on :${config.port} (config ${file})`);
  shutdown = () => {
    clearInterval(timer);
    for (const w of Object.values(cluster.workers ?? {})) w?.kill('SIGTERM');
    void db.destroy().then(() => process.exit(0));
  };
} else {
  const server = serve(
    { fetch: createApp({ db, def, metrics }).fetch, port: config.port },
    (info) => {
      if (!isWorker) console.log(`accord server listening on :${info.port} (config ${file})`);
    },
  );
  shutdown = () => {
    clearInterval(timer);
    server.close(() => void db.destroy().then(() => process.exit(0)));
  };
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
