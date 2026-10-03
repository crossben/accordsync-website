import { assertNode, PROTOCOL_VERSION } from '@accordsync/core';
import { Value } from '@sinclair/typebox/value';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { AuthError, createVerifier } from './auth';
import type { Db } from './db';
import type { ServerDefinition } from './define';
import { createMetrics, type Metrics } from './metrics';
import { RateLimiter } from './ratelimit';
import { PushRequestSchema } from './protocol';
import {
  BadRequest,
  type Caller,
  deviceTtlMs,
  Forbidden,
  pull,
  push,
  type SyncContext,
  touchDevice,
} from './sync';

export interface AppDeps {
  db: Db;
  def: ServerDefinition;
  /** Physical time in ms (injectable for tests). */
  now?: () => number;
  /** Share one registry with the compaction job (created when omitted). */
  metrics?: Metrics;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const verify = createVerifier(deps.def.auth);
  const metrics = deps.metrics ?? createMetrics(deps.db, deps.def);
  const ctx: SyncContext = { db: deps.db, def: deps.def, now: deps.now ?? Date.now, metrics };

  app.use(async (c, next) => {
    const end = metrics.requestSeconds.startTimer();
    await next();
    end({ route: c.req.routePath, status: String(c.res.status) });
  });

  app.use(async (c, next) => {
    await next();
    c.header('Accord-Protocol', String(PROTOCOL_VERSION));
  });

  if (deps.def.cors?.length) {
    app.use(
      cors({
        origin: [...deps.def.cors],
        allowHeaders: ['Authorization', 'Accord-Device', 'Content-Type'],
        exposeHeaders: ['Accord-Protocol'],
        maxAge: 600,
      }),
    );
  }

  app.onError((err, c) => {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401);
    if (err instanceof Forbidden) return c.json({ error: err.message }, 403);
    if (err instanceof BadRequest) return c.json({ error: err.message }, 400);
    if (err instanceof TooManyRequests) {
      c.header('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
      return c.json({ error: 'too many requests' }, 429);
    }
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  app.get('/health', async (c) => {
    try {
      await sql`select 1`.execute(deps.db);
      return c.json({ status: 'ok', protocolVersion: PROTOCOL_VERSION });
    } catch {
      return c.json({ status: 'unavailable', reason: 'database unreachable' }, 503);
    }
  });

  app.use(
    '/v1/*',
    bodyLimit({
      maxSize: deps.def.limits?.maxBodyBytes ?? 5 * 1024 * 1024,
      onError: (c) => c.json({ error: 'request body too large' }, 413),
    }),
  );

  const metricsToken = deps.def.metrics?.token;
  if (metricsToken) {
    app.get('/metrics', async (c) => {
      if (!sameSecret(c.req.header('Authorization') ?? '', `Bearer ${metricsToken}`)) {
        return c.json({ error: 'metrics token required' }, 401);
      }
      return c.text(await metrics.registry.metrics(), 200, {
        'Content-Type': metrics.registry.contentType,
      });
    });
  }

  const limits = deps.def.rateLimit === false ? undefined : deps.def.rateLimit;
  const limiters =
    deps.def.rateLimit === false
      ? undefined
      : {
          device: new RateLimiter(limits?.perDevice ?? { perMinute: 600 }, ctx.now),
          user: new RateLimiter(limits?.perUser ?? { perMinute: 1800 }, ctx.now),
        };

  const caller = async (c: Context): Promise<Caller> => {
    const claims = await verify(c.req.header('Authorization'));
    const deviceId = c.req.header('Accord-Device') ?? '';
    try {
      assertNode(deviceId);
    } catch {
      throw new BadRequest('Accord-Device header must be a device id ([A-Za-z0-9_-]{1,64})');
    }
    if (limiters) {
      const wait = Math.max(limiters.device.take(deviceId), limiters.user.take(claims.sub));
      if (wait > 0) throw new TooManyRequests(wait);
    }
    const access = deps.def.access(claims);
    const who: Caller = { sub: claims.sub, deviceId, read: access.read, write: access.write };
    await touchDevice(deps.db, who, deviceTtlMs(deps.def));
    return who;
  };

  app.post('/v1/push', async (c) => {
    const who = await caller(c);
    const body: unknown = await c.req.json().catch(() => {
      throw new BadRequest('body must be JSON');
    });
    if (!Value.Check(PushRequestSchema, body))
      throw new BadRequest('body must be { "ops": [...] }');
    return c.json(await push(ctx, who, body.ops));
  });

  app.get('/v1/pull', async (c) => {
    const who = await caller(c);
    const cursor = Number(c.req.query('cursor') ?? '0');
    const limit = Number(c.req.query('limit') ?? '500');
    if (!Number.isSafeInteger(cursor) || cursor < 0)
      throw new BadRequest('cursor must be an integer ≥ 0');
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new BadRequest('limit must be an integer ≥ 1');
    return c.json(await pull(ctx, who, cursor, limit));
  });

  return app;
}

/** Constant-time comparison, so response timing reveals nothing about the secret. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

class TooManyRequests extends Error {
  override readonly name = 'TooManyRequests';
  constructor(readonly retryAfterMs: number) {
    super('too many requests');
  }
}
