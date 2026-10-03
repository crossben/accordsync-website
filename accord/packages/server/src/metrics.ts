import { sql } from 'kysely';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { Db } from './db';
import type { ServerDefinition } from './define';
import { deviceTtlMs } from './sync';

/** Prometheus metrics for one server. Each server has its own registry (no global state). */
export function createMetrics(db: Db, def: ServerDefinition) {
  const registry = new Registry();
  const ttlSecs = deviceTtlMs(def) / 1000;

  const m = {
    registry,
    pushOps: new Counter({
      name: 'accord_push_ops_total',
      help: 'Ops received by push, by outcome',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    pushBatch: new Histogram({
      name: 'accord_push_batch_size',
      help: 'Ops per push request',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500],
      registers: [registry],
    }),
    pulls: new Counter({
      name: 'accord_pulls_total',
      help: 'Pull requests, by outcome',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    pullItems: new Counter({
      name: 'accord_pull_items_total',
      help: 'Items (ops, snapshots, exits) sent by pull',
      registers: [registry],
    }),
    requestSeconds: new Histogram({
      name: 'accord_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['route', 'status'] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [registry],
    }),
    compactedOps: new Counter({
      name: 'accord_compaction_ops_folded_total',
      help: 'Ops folded into snapshots',
      registers: [registry],
    }),
  };

  // Read from the database when Prometheus scrapes.
  new Gauge({
    name: 'accord_feed_head',
    help: 'Highest feed position (total accepted ops and scope changes, minus compaction)',
    registers: [registry],
    async collect() {
      const r = await sql<{ head: string }>`select coalesce(max(seq), 0) as head from feed`.execute(
        db,
      );
      this.set(Number(r.rows[0]?.head ?? 0));
    },
  });
  new Gauge({
    name: 'accord_devices_live',
    help: 'Devices seen within the retirement TTL',
    registers: [registry],
    async collect() {
      const r = await sql<{ n: string }>`select count(*) as n from devices
        where last_seen > now() - make_interval(secs => ${ttlSecs})`.execute(db);
      this.set(Number(r.rows[0]?.n ?? 0));
    },
  });
  new Gauge({
    name: 'accord_sync_lag',
    help: 'Feed positions between the newest final position and the slowest live device (what compaction waits for)',
    registers: [registry],
    async collect() {
      const r = await sql<{ lag: string }>`select greatest(0, (accord_horizon() - 1) - coalesce(
          (select min(cursor) from devices where last_seen > now() - make_interval(secs => ${ttlSecs})),
          accord_horizon() - 1)) as lag`.execute(db);
      this.set(Number(r.rows[0]?.lag ?? 0));
    },
  });
  return m;
}

export type Metrics = ReturnType<typeof createMetrics>;
