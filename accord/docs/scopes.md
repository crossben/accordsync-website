# Writing scope rules

Scopes decide who can read and write which records. They are your access policy, so they deserve
the same care as any authorisation code. This page explains how they work, gives five patterns, and
lists the mistakes to avoid.

Each pattern below is in [`examples/scopes/patterns.ts`](../examples/scopes/patterns.ts), and
[`scope-patterns.test.ts`](../packages/server/test/scope-patterns.test.ts) checks who can read and
write what. Copy the one closest to your app, then adapt its test.

## How scopes work

Two functions in `defineServer`:

```ts
defineServer({
  schema,
  // For each record type: the scope keys a record belongs to, from its current fields.
  scopes: { dossier: (record) => [`agent:${record.fields.agent}`, `zone:${record.fields.zone}`] },
  // From the user's verified JWT: the keys they may read, and the keys they may write.
  access: (claims) => ({ read: [`agent:${claims.sub}`], write: [`agent:${claims.sub}`] }),
  auth: { jwksUrl: '…' },
});
```

- A user **reads** a record when the record's keys and the user's read keys share at least one key.
- A user **writes** an existing record when its _current_ keys share a key with the user's write
  keys. A **new** record is checked against the keys it would have _after_ the write.
- Keys are plain strings. A prefix such as `agent:` or `zone:` keeps different kinds from colliding.
- When a write changes a record's keys (a dossier reassigned), devices that can no longer see it get
  an `exit` and delete it; devices that now can get its whole history.
- When a user's claims change (a new zone), their next pull brings the records that entered and
  removes the ones that left ([ADR-0011](adr/0011-scope-delta.md)).

## Patterns

### 1. Personal

Each user sees and edits only their own records: notes, drafts, settings.

```ts
scopes: { note: (r) => key('owner', r.fields.owner) },
access: (c) => ({ read: [`owner:${c.sub}`], write: [`owner:${c.sub}`] }),
```

Create records with `owner` set to the user's own id in the first write; otherwise the write is
refused, because the new record would not be in the user's scope.

### 2. Field team

Agents work on their own dossiers, and everyone in a zone can read the zone's dossiers.

```ts
scopes: { dossier: (r) => [...key('agent', r.fields.agent), ...key('zone', r.fields.zone)] },
access: (c) => ({
  read: [`agent:${c.sub}`, ...list(c.zones).map((z) => `zone:${z}`)],
  write: [`agent:${c.sub}`],
}),
```

### 3. Supervisor

As the field team, plus supervisors may write every dossier of their zones.

```ts
access: (c) => {
  const zones = list(c.zones).map((z) => `zone:${z}`);
  return {
    read: [`agent:${c.sub}`, ...zones],
    write: [`agent:${c.sub}`, ...(c.role === 'supervisor' ? zones : [])],
  };
},
```

### 4. Multi-tenant

Organisations never see each other's data. Within one, everyone reads and only admins write.

```ts
scopes: { invoice: (r) => key('org', r.fields.org) },
access: (c) => {
  const org = typeof c.org === 'string' ? `org:${c.org}` : null;
  return { read: org ? [org] : [], write: org && c.role === 'admin' ? [org] : [] };
},
```

### 5. Shared lists

A record lists its members in a `set()` field; members read and write it. Adding or removing a member
moves the record into or out of that member's devices.

```ts
scopes: { list: (r) => list(r.fields.members).map((m) => `member:${m}`) },
access: (c) => ({ read: [`member:${c.sub}`], write: [`member:${c.sub}`] }),
```

`key` and `list` are three-line helpers in the examples file: they return no key for a missing or
empty field.

## Rules that keep scopes correct

1. **Fail closed.** A record with no keys is visible to nobody. Never return a catch-all key such as
   `all` for missing fields; the test "records without the scoping field are invisible" guards this
   in every pattern.
2. **Keep scope functions pure.** Same fields in, same keys out: no clock, no randomness, no network,
   no database. The server calls them on every write; a scope that depends on the time of day would
   move records with no write to record it.
3. **Read only fields that merge predictably.** Prefer `lww()` or `set()` fields for scoping. A
   `conflict()` field reads as `{ value }` or `{ conflicted: […] }`; if you scope on one, decide what a
   conflicted value means (usually: the union of every candidate's keys).
4. **Put the scoping field in the first write.** A new record is checked against the keys it would
   have after the write, so create it with its owner, zone or org already set.
5. **Think about moves.** Reassigning a record is a write by someone allowed to write it _now_. After
   the move, that person may lose access: that is intended, and their later offline edits to it are
   refused and reported, never silently lost.
6. **Claims are read on every request.** A change of role or zone takes effect at the user's next
   sync. Removing someone's access early needs a short token lifetime: Accord cannot revoke a token
   that is still valid.
7. **Test them like code.** Copy the pattern test and add your own cases: one user who should see a
   record, one who should not, one who may read but not write.
