// The Accord server: your schema, who may read and write what, and how tokens are checked.
// Scope patterns for teams, zones, tenants: https://github.com/crossben/accordsync/blob/main/docs/scopes.md
import { defineServer } from '@accordsync/server';
import { schema } from './schema.ts';

export default defineServer({
  schema,
  scopes: {
    // Each task belongs to its owner. No owner: visible to nobody (fail closed).
    task: (r) => (typeof r.fields.owner === 'string' ? [`owner:${r.fields.owner}`] : []),
  },
  access: (claims) => ({ read: [`owner:${claims.sub}`], write: [`owner:${claims.sub}`] }),
  // Development: tokens signed with ACCORD_DEV_SECRET (see dev-token.mjs).
  // Production: { jwksUrl: 'https://your-auth/.well-known/jwks.json', issuer: '…', audience: '…' }
  auth: { hs256Secret: required('ACCORD_DEV_SECRET') },
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: copy .env.example to .env`);
  return value;
}
