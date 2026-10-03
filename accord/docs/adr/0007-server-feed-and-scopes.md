# ADR-0007: The server feed, sync scopes in code, and resync on scope change

- Status: accepted
- Date: 2026-10-02

## Decisions

**Scopes are declared in TypeScript.** Self-hosters write an `accord.config.ts` with
`defineServer({ schema, scopes, access, auth })`, run by `accord serve`:

- `scopes[type](record)` returns the scope keys a record belongs to, from its current state;
- `access(claims)` returns the keys a user may read and write, from their verified JWT.

This was chosen over a declarative rule language (another mini-language to design and secure) and
over scope keys in the JWT alone (pushes all logic to the app's auth server).

**One append-only feed.** PostgreSQL holds a `feed` table of accepted ops and scope changes, ordered
by a global `seq`. A trigger refuses updates and deletes, except for compaction (ADR-0005). The pull
cursor is a `seq`.

**Pushes are serialized.** Each push transaction takes one advisory lock, so `seq` values commit in
order. Without it, a puller could see `seq` 11 before a slower transaction commits `seq` 10, move
its cursor past 10, and never receive that op. Write throughput is limited to one push transaction
at a time; the M6 load test measures what that costs. If it matters, a later version can keep
concurrency and have pulls stop at the lowest uncommitted `seq` instead.

**Scope membership travels in the feed.** When an op changes a record's scope keys, a scope row
records before and after. A pull sends op rows whose record is in the caller's read keys, the full
history of a record that enters them, and an `exit` marker for a record that leaves them.

**A change of read keys forces a resync.** The server remembers the read keys each device last
pulled from zero with. If they differ, the pull answers `resync_required`, and the client starts
again from cursor 0. This costs bandwidth when claims change, which is rare, and avoids computing
per-device scope differences.

## Consequences

- Authorisation is enforced on the server, for every push and every pull.
- Each push re-read the history of the records it touches; [ADR-0009](0009-server-record-state.md)
  replaced that with a stored per-record state.
