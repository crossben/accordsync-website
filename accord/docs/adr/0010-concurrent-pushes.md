# ADR-0010: Concurrent pushes, transaction-ordered pulls, and op ids that are never reused

- Status: accepted
- Date: 2026-10-03
- Supersedes: the "pushes are serialized" decision of [ADR-0007](0007-server-feed-and-scopes.md)

## Context

v0.1 serialized every push behind one lock, so that feed `seq` values became visible in order and a
pull cursor could never skip a slower transaction's op. The load test measured the cost: about
1 000 ops/s, with more devices only waiting longer.

## Decision

**Pushes run concurrently.** A push takes the feed lock in _shared_ mode and row locks on the records
it writes, in sorted order (no deadlocks). Two pushes conflict only when they write the same record.
Compaction takes the feed lock _exclusively_, so the ops it folds cannot change underneath it. A
per-process limit (`limits.maxConcurrentPushes`, default 8) keeps database connections free for pulls.

**Pulls read the feed in transaction order, up to a horizon.** Each feed row has a `pos`: the id of
the transaction that wrote it (shifted past every pre-upgrade `seq`). A pull reads rows ordered by
`(pos, seq)`, and only those with `pos` below the horizon: the oldest transaction id still running.
Every transaction below the horizon has finished, so nothing can ever appear there again. The cursor
is a `pos`; a page always ends on a transaction boundary (a transaction larger than a page is sent
whole). The cursor stays an integer, so clients do not change.

**Upgrade:** migration 0005 keeps old rows in their order (`pos = seq`) and sends every device back
to cursor 0 once (`resync_required`), because cursor values changed meaning.

**Op ids are never reused, even by a device that lost its storage.**

- The core advances a device's op counter past any of its own ops it receives.
- The server records the highest op number applied from each device and returns it on every pull
  (`device_seq`); the client advances its counter past it.
- An op whose id is already in the feed is a retry only if it is the same op. The same id with
  different content, or an unknown op numbered at or below the device's highest applied number, is
  **refused** ("op id already used"), never silently acknowledged.

**Compacted-op entries are pruned.** Clients push their outbox in order (now a protocol rule), so once
a device sends a push whose lowest op number is N, it has its answers for every op below N and will
never resend them. The server keeps that `push_floor` per device, and compaction deletes compacted-op
entries below it.

## Consequences

- Measured on the same laptop as v0.1: see [load/README.md](../../load/README.md).
- A device that reinstalls with the same id and writes before its first sync gets those writes
  refused (reported to the app) instead of losing them silently. The client generates a fresh
  random device id by default, which avoids this entirely.
- Third-party clients must push in write order and advance their counter past `device_seq`.

## Update (2026-10-06): compacted ops keep a content hash

The conformance suite found that once an op was folded by compaction, only its id was kept, so a
_different_ op reusing that id was acknowledged as a retry and silently dropped. `compacted_ops` now
has `op_hash` (migration `0006_compacted_op_hash`): the SHA-256, lowercase hex, of the UTF-8
canonical JSON of the op's wire form. A pushed op whose id is in `compacted_ops` is acknowledged
only when its hash matches, and refused with `op id already used` otherwise. Rows folded before the
migration have no hash and are acknowledged as before. Every server implementation computes the hash
the same way, since it is stored in the shared database.
