# ADR-0009: The server keeps each record's current state

- Status: accepted
- Date: 2026-10-02
- Builds on: [ADR-0008](0008-snapshots.md)

## Context

Each push rebuilt the state of the records it touched by replaying their history from the feed.
The first load test showed the cost: a record many devices write to (a zone's shared dossier) gets a
longer history with every op, so its pushes slow down linearly until the next compaction.

## Decision

- `records.state` holds the record's current snapshot (the same format as ADR-0008), updated in the
  same transaction as every accepted op.
- A push loads that one row, applies its ops on top, and writes it back. Duplicate detection looks
  op ids up in the feed and in `compacted_ops` instead of in a rebuilt replica.
- This is safe for the same reason compaction is: the feed is causally ordered, so a state without
  tombstones gives the same result as the full history for every op that can still arrive.
- Records written before migration 0004 have no stored state; their first push rebuilds it from the
  feed.

## Consequences

- Push cost no longer depends on a record's history length.
- A test checks that the stored state always equals a rebuild from the feed.
- The feed remains the source of truth; `records.state` can be rebuilt from it at any time.
- Pushes also queue inside the server process before taking a database connection, so pushes waiting
  for the feed lock cannot hold every connection and stall pulls. The advisory lock still
  serializes pushes across processes. Measured effect: pull p95 at 200 devices went from 1 521 ms to
  20 ms ([load results](../../load/README.md)).
