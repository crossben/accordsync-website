// Scope patterns from docs/scopes.md. Each is a complete `scopes` + `access` pair; the test next to
// this file checks who can read and write what.
import type { Claims, ScopedRecord } from '@accordsync/server';

const key = (prefix: string, v: unknown) =>
  typeof v === 'string' && v !== '' ? [`${prefix}:${v}`] : [];
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** 1. Personal: each user sees and edits only their own records. */
export const personal = {
  scopes: (r: ScopedRecord) => key('owner', r.fields.owner),
  access: (c: Claims) => ({ read: [`owner:${c.sub}`], write: [`owner:${c.sub}`] }),
};

/** 2. Field team: agents work on their own dossiers; everyone in a zone can read the zone's. */
export const fieldTeam = {
  scopes: (r: ScopedRecord) => [...key('agent', r.fields.agent), ...key('zone', r.fields.zone)],
  access: (c: Claims) => ({
    read: [`agent:${c.sub}`, ...list(c.zones).map((z) => `zone:${z}`)],
    write: [`agent:${c.sub}`],
  }),
};

/** 3. Supervisor: like the field team, plus supervisors may write every dossier of their zones. */
export const supervised = {
  scopes: fieldTeam.scopes,
  access: (c: Claims) => {
    const zones = list(c.zones).map((z) => `zone:${z}`);
    return {
      read: [`agent:${c.sub}`, ...zones],
      write: [`agent:${c.sub}`, ...(c.role === 'supervisor' ? zones : [])],
    };
  },
};

/** 4. Organisation: tenants are isolated; within one, everyone reads, only admins write. */
export const multiTenant = {
  scopes: (r: ScopedRecord) => key('org', r.fields.org),
  access: (c: Claims) => {
    const org = typeof c.org === 'string' ? `org:${c.org}` : null;
    return {
      read: org ? [org] : [],
      write: org && c.role === 'admin' ? [org] : [],
    };
  },
};

/** 5. Shared lists: a record lists its members (a `set()` field); members read and write it. */
export const sharedLists = {
  scopes: (r: ScopedRecord) => list(r.fields.members).map((m) => `member:${m}`),
  access: (c: Claims) => ({ read: [`member:${c.sub}`], write: [`member:${c.sub}`] }),
};
