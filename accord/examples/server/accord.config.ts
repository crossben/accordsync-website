// An Accord server for a field app: dossiers belong to an agent and a zone.
// Run: ACCORD_DATABASE_URL=... ACCORD_DEV_SECRET=... accord serve --config accord.config.ts
import { defineServer } from '@accordsync/server';
import { schema } from './schema.ts';

export default defineServer({
  schema,
  // Which scope keys a record belongs to, from its current state.
  scopes: {
    dossier: (r) =>
      [
        typeof r.fields.agent === 'string' ? `agent:${r.fields.agent}` : undefined,
        typeof r.fields.zone === 'string' ? `zone:${r.fields.zone}` : undefined,
      ].filter((k) => k !== undefined),
  },
  // Which keys a user may read and write, from the JWT your app issued. Here, agents work on
  // their own dossiers and on every dossier of their zones.
  access: (claims) => {
    const zones = Array.isArray(claims.zones) ? claims.zones.map(String) : [];
    const keys = [`agent:${claims.sub}`, ...zones.map((z) => `zone:${z}`)];
    return { read: keys, write: keys };
  },
  auth: process.env.ACCORD_JWKS_URL
    ? { jwksUrl: process.env.ACCORD_JWKS_URL }
    : { hs256Secret: required('ACCORD_DEV_SECRET') },
  cors: process.env.ACCORD_CORS_ORIGINS?.split(',').filter(Boolean) ?? [],
  // Rate limits are on by default; benchmarks that push non-stop turn them off.
  ...(process.env.ACCORD_RATE_LIMIT === 'off' ? { rateLimit: false as const } : {}),
  ...(process.env.ACCORD_METRICS_TOKEN
    ? { metrics: { token: process.env.ACCORD_METRICS_TOKEN } }
    : {}),
});

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required (or set ACCORD_JWKS_URL)`);
  return v;
}
