import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, migrateToLatest } from '../src/index';
import { def, type Harness, startHarness } from './harness';

describe('server against real PostgreSQL', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  }, 120_000);

  afterAll(async () => h?.stop());

  it('migrations are idempotent', async () => {
    await expect(migrateToLatest(h.db)).resolves.toBeUndefined();
  });

  it('reports health with the protocol version', async () => {
    const res = await h.app.request('/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('Accord-Protocol')).toBe('1');
    expect(await res.json()).toEqual({ status: 'ok', protocolVersion: 1 });
  });

  it('answers CORS preflights only for configured origins', async () => {
    const app = createApp({ db: h.db, def: { ...def, cors: ['https://app.example'] } });
    const preflight = (origin: string) =>
      app.request('/v1/push', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,accord-device,content-type',
        },
      });
    const ok = await preflight('https://app.example');
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(ok.headers.get('Access-Control-Allow-Headers')).toMatch(/Accord-Device/i);
    const other = await preflight('https://evil.example');
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('serves Prometheus metrics only with the metrics token', async () => {
    const app = createApp({ db: h.db, def: { ...def, metrics: { token: 'scrape-me' } } });
    await app.request('/health');
    expect((await app.request('/metrics')).status).toBe(401);
    const res = await app.request('/metrics', { headers: { Authorization: 'Bearer scrape-me' } });
    expect(res.status).toBe(200);
    const body = await res.text();
    for (const name of [
      'accord_feed_head',
      'accord_devices_live',
      'accord_sync_lag',
      'accord_push_ops_total',
      'accord_http_request_duration_seconds_bucket',
    ]) {
      expect(body).toContain(name);
    }
    expect((await createApp({ db: h.db, def }).request('/metrics')).status).toBe(404);
  });

  it('refuses request bodies over the size limit', async () => {
    const app = createApp({ db: h.db, def: { ...def, limits: { ...def.limits, maxBodyBytes: 1024 } } });
    const res = await app.request('/v1/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '5000' },
      body: JSON.stringify({ ops: [], pad: 'x'.repeat(5000) }),
    });
    expect(res.status).toBe(413);
  });
});
