import {
  conflict,
  counter,
  decodeOp,
  defineSchema,
  encodeOp,
  LocalWriter,
  lww,
  type Op,
  set,
} from '@accordsync/core';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { SignJWT } from 'jose';
import { sql } from 'kysely';
import { createApp } from '../src/app';
import { createDb, type Db } from '../src/db';
import { defineServer } from '../src/define';
import { migrateToLatest } from '../src/migrate';
import type { PullItem, PullResponse, PushResponse } from '../src/protocol';

export const SECRET = 'test-secret-at-least-32-bytes-long!!';

export const schema = defineSchema({
  dossier: { agent: lww(), zone: lww(), status: conflict(), visits: counter(), docs: set() },
});

/** Dossiers belong to their agent and their zone. Agents read their own dossiers and their zones'. */
export const def = defineServer({
  schema,
  scopes: {
    dossier: (r) =>
      [
        typeof r.fields.agent === 'string' ? `agent:${r.fields.agent}` : null,
        typeof r.fields.zone === 'string' ? `zone:${r.fields.zone}` : null,
      ].filter((k): k is string => k !== null),
  },
  access: (claims) => {
    const zones = Array.isArray(claims.zones) ? (claims.zones as string[]) : [];
    return {
      read: [`agent:${claims.sub}`, ...zones.map((z) => `zone:${z}`)],
      write: [`agent:${claims.sub}`],
    };
  },
  auth: { hs256Secret: SECRET, issuer: 'test-app' },
  limits: { maxPushOps: 100 },
  compaction: { minOps: 2, deviceTtlDays: 30 },
  rateLimit: false,
});

export interface Harness {
  db: Db;
  /** Connection string, for tests that need their own connection. */
  url: string;
  app: ReturnType<typeof createApp>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
}

export async function startHarness(now: () => number = Date.now): Promise<Harness> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();
  const db = createDb(container.getConnectionUri());
  await migrateToLatest(db);
  return {
    db,
    url: container.getConnectionUri(),
    app: createApp({ db, def, now }),
    reset: async () => {
      await sql`truncate feed, records, devices restart identity`.execute(db);
    },
    stop: async () => {
      await db.destroy();
      await container.stop();
    },
  };
}

export async function token(sub: string, claims: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer('test-app')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

/** A device talking to the server over HTTP, the way the real client will. */
export class TestDevice {
  readonly writer: LocalWriter;
  cursor = 0;

  constructor(
    private readonly h: Harness,
    readonly id: string,
    public jwt: string,
  ) {
    this.writer = new LocalWriter({ schema, deviceId: id, now: Date.now });
  }

  async push(ops: readonly Op[] | unknown[]): Promise<{ status: number; body: PushResponse }> {
    const res = await this.h.app.request('/v1/push', {
      method: 'POST',
      headers: this.#headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ops: ops.map((o) => (isOp(o) ? encodeOp(o) : o)) }),
    });
    return { status: res.status, body: (await res.json()) as PushResponse };
  }

  async pull(limit = 500, cursor = this.cursor): Promise<PullResponse> {
    const res = await this.h.app.request(`/v1/pull?cursor=${cursor}&limit=${limit}`, {
      headers: this.#headers(),
    });
    if (res.status !== 200) throw new Error(`pull ${res.status}: ${await res.text()}`);
    return (await res.json()) as PullResponse;
  }

  /** Pulls every page, applying ops and exits to the local replica. Returns the items seen. */
  async pullAll(limit = 500): Promise<PullItem[]> {
    const seen: PullItem[] = [];
    for (;;) {
      const page = await this.pull(limit);
      if ('resync_required' in page) throw new Error('unexpected resync_required');
      if (page.device_seq !== undefined) this.writer.advanceSeq(page.device_seq);
      for (const item of page.items) {
        seen.push(item);
        if (item.type === 'op') this.writer.receive(decodeOp(item.op));
        if (item.type === 'snapshot') this.writer.replica.loadSnapshot(item.snapshot);
      }
      this.cursor = page.cursor;
      if (!page.has_more) return seen;
    }
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.jwt}`, 'Accord-Device': this.id, ...extra };
  }
}

function isOp(o: unknown): o is Op {
  return typeof o === 'object' && o !== null && 'opId' in o;
}
