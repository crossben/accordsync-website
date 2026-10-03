// Development tokens only: signs an HS256 JWT with ACCORD_DEV_SECRET, using Node's crypto.
// In production your auth server issues tokens and Accord checks them against its JWKS.
import { createHmac } from 'node:crypto';

export function devToken(sub, claims = {}) {
  const secret = process.env.ACCORD_DEV_SECRET;
  if (!secret) throw new Error('ACCORD_DEV_SECRET is not set: copy .env.example to .env');
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(devToken(process.argv[2] ?? 'awa'));
}
