# ADR-0008: Compaction folds history into record snapshots

- Status: accepted
- Date: 2026-10-02
- Implements: [ADR-0005](0005-compaction-device-ttl.md)

## Context

The feed grows with every op. A device starting from zero, or a record entering a user's scope,
would replay a record's whole history.

## Decision

- A **snapshot** is a record's live state per field: the `lww` winner (value, clock, op id), the
  counter total, the set's live add-tags, the conflict field's live values.
- Snapshots **drop tombstones** (removed set tags, superseded conflict values). That is safe because
  the server feed is causally ordered: an op that names other ops in `deps` (a remove, a conflict
  resolution) is always written after the ops it names, since its writer could only have seen them
  through the server or from its own earlier writes, which it pushes in order. A property test checks
  that `snapshot(prefix) + rest = everything` on simulated server feeds, and fails when the feed is
  shuffled.
- **When:** a record is compacted once every live device's cursor is past all its ops (devices
  report their cursor on each pull; retired devices, unseen for `deviceTtlDays`, do not count).
  `accord serve` compacts every hour, and `accord compact` does it once.
- **Where in the feed:** the snapshot row takes the `seq` of the last op it replaces. Live devices,
  whose cursors are past it, never receive it. Devices pulling from zero, and records entering a
  scope, get the snapshot and then any later ops.
- **Idempotency:** the ids of folded ops are kept in `compacted_ops`, so a retried push of one is
  acknowledged and not applied twice.
- **Scope changes are written before the op that causes them**, so a device a record is entering
  gets its history (snapshot first) before that op.
- **Retired devices** coming back are flagged on their next request; their next pull answers
  `resync_required`. Their unpushed ops are pushed first and merge normally.
- **Clients** store snapshots next to ops. Receiving a snapshot replaces the record's received ops
  and re-applies the device's unpushed ops on top.

## Consequences

- Feed size per record is bounded by the ops since the slowest live device last synced.
- `compacted_ops` grows by one short row per folded op. A later version can prune it once no live
  device could still retry those ops.
