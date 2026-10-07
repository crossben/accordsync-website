import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCORD_URL, assertError, control, Device, http, profile } from './accord';

const sign = (claims: Record<string, unknown>, secret = profile.auth.hs256Secret) => {
  let jwt = new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h');
  if (profile.auth.issuer) jwt = jwt.setIssuer(profile.auth.issuer);
  return jwt.sign(new TextEncoder().encode(secret));
};

describe('HTTP, authentication and errors (docs/protocol.md)', () => {
  let alice: Device;
  beforeEach(async () => {
    await control.reset();
    alice = await Device.of('alice-phone', 'alice', { zones: ['dakar'] });
  });

  it('GET /health answers 200 { status: "ok", protocolVersion: 1 } without auth', async () => {
    const r = await http('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok', protocolVersion: 1 });
  });

  it('every response carries Accord-Protocol: 1 (200, 400, 401, 403, 413) — checked by the client helper on each call', async () => {
    // `http()` and `Device` assert the header on every response; this test touches each status.
    expect((await alice.pullRaw(0)).status).toBe(200);
    expect((await alice.pushBody('{"ops":[]}')).status).toBe(200);
    expect((await http('/v1/pull?cursor=0')).status).toBe(401);
    expect((await alice.pullRaw(-1)).status).toBe(400);
    const thief = await Device.of('alice-phone', 'bob');
    expect((await thief.pullRaw(0)).status).toBe(403);
    expect((await alice.pushBody('x'.repeat(profile.limits.maxBodyBytes + 1))).status).toBe(413);
  });

  it('401 without a bearer token, on pull and push', async () => {
    const pull = await http('/v1/pull?cursor=0', { headers: { 'Accord-Device': 'alice-phone' } });
    expect(pull.status).toBe(401);
    const push = await http('/v1/push', {
      method: 'POST',
      headers: { 'Accord-Device': 'alice-phone', 'Content-Type': 'application/json' },
      body: '{"ops":[]}',
    });
    expect(push.status).toBe(401);
  });

  it('401 for a malformed token, a wrong signature, an expired token, or no "sub" claim', async () => {
    const tokens = [
      'not-a-jwt',
      await sign({ sub: 'alice' }, 'some-other-secret-at-least-32-bytes-long'),
      await control.token('alice', { exp_in: -120 }),
      await sign({ zones: ['dakar'] }),
    ];
    for (const t of tokens) {
      const r = await http('/v1/pull?cursor=0', {
        headers: { Authorization: `Bearer ${t}`, 'Accord-Device': 'alice-phone' },
      });
      expect(r.status, t).toBe(401);
    }
    // Not a Bearer scheme.
    const basic = await http('/v1/pull?cursor=0', {
      headers: { Authorization: `Basic ${alice.jwt}`, 'Accord-Device': 'alice-phone' },
    });
    expect(basic.status).toBe(401);
  });

  it('400 without an Accord-Device header, or with a device id outside [A-Za-z0-9_-]{1,64}', async () => {
    for (const device of [undefined, '', 'has space', 'a:b', 'x'.repeat(65)]) {
      const headers: Record<string, string> = { Authorization: `Bearer ${alice.jwt}` };
      if (device !== undefined) headers['Accord-Device'] = device;
      const r = await http('/v1/pull?cursor=0', { headers });
      expect(r.status, String(device)).toBe(400);
    }
    expect((await new Device('x'.repeat(64), alice.jwt).pullRaw(0)).status).toBe(200);
  });

  it('403 when the device id belongs to another user (bound on first use)', async () => {
    expect((await alice.pullRaw(0)).status).toBe(200);
    const bobOnAlicesPhone = await Device.of('alice-phone', 'bob');
    const pull = await bobOnAlicesPhone.pullRaw(0);
    expect(pull.status).toBe(403);
    const push = await bobOnAlicesPhone.push([]);
    expect(push.status).toBe(403);
    // Still alice's.
    expect((await alice.pullRaw(0)).status).toBe(200);
  });

  it('400 for a bad cursor or limit', async () => {
    for (const q of ['cursor=-1', 'cursor=abc', 'cursor=1.5', 'cursor=0&limit=0', 'limit=-3']) {
      const r = await http(`/v1/pull?${q}`, { headers: alice.headers() });
      expect(r.status, q).toBe(400);
    }
  });

  it('400 for a push body that is not JSON or not { "ops": [...] }', async () => {
    for (const body of ['not json', '[]', '{}', '{"ops":{}}', '{"ops":[],"extra":1}']) {
      expect((await alice.pushBody(body)).status, body).toBe(400);
    }
  });

  it('413 when the request body is larger than maxBodyBytes', async () => {
    const big = alice.assign('dossier:1', 'client_name', 'x'.repeat(profile.limits.maxBodyBytes));
    const r = await alice.push([big]);
    expect(r.status).toBe(413);
    assertError(r.body);
    // Just under the limit is accepted.
    const ok = alice.assign('dossier:1', 'agent', 'alice');
    expect((await alice.push([ok])).status).toBe(200);
  });

  it('429 with Retry-After (whole seconds) when a device exceeds its rate limit', async () => {
    // Bursts back to back until the bucket runs dry. One burst of burst + 50 trips the limit only
    // on a server answering faster than the bucket refills during the burst; a full framework
    // under PHP-FPM is not, so later bursts start from a partly drained bucket. Any server faster
    // than the refill rate (perDevice.perMinute / 60 per second) ends up refusing.
    const n = profile.rateLimit.perDevice.burst + 50;
    // Empty pushes: concurrent pulls from one device are not something clients do.
    const results: Response[] = [];
    for (let burst = 0; burst < 10 && !results.some((r) => r.status === 429); burst++) {
      results.push(
        ...(await Promise.all(
          Array.from({ length: n }, () =>
            fetch(`${ACCORD_URL}/v1/push`, {
              method: 'POST',
              headers: alice.headers({ 'Content-Type': 'application/json' }),
              body: '{"ops":[]}',
            }),
          ),
        )),
      );
    }
    const limited = results.filter((r) => r.status === 429);
    expect(limited.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === 200 || r.status === 429)).toBe(true);
    for (const r of limited) {
      expect(r.headers.get('Accord-Protocol')).toBe('1');
      expect(r.headers.get('Retry-After')).toMatch(/^[1-9][0-9]*$/);
      assertError(await r.json());
    }
    await Promise.all(results.filter((r) => r.status !== 429).map((r) => r.arrayBuffer()));
  });
});
