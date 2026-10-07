# ADR-0011: A change of read scopes is sent as a delta

- Status: accepted
- Date: 2026-10-03
- Supersedes: the "resync on scope change" decision of [ADR-0007](0007-server-feed-and-scopes.md)

## Context

When a user's claims changed (a new zone, a team change), v0.1 answered `resync_required`: the device
dropped its data and pulled everything again. On mobile data that is the most expensive thing Accord
can ask of a device, for what is usually a small change.

## Decision

When a device pulls with read keys different from the ones it last used, the server computes the
change from the records' **current** scope keys:

- records visible now but not before: their whole history (snapshot and ops) is sent first in the
  page;
- records visible before but not now, through any key: an `exit`;
- everything else: nothing.

Then the page continues from the device's cursor as usual. History or an exit that the feed sends
again later is harmless: applying an op twice changes nothing, and forgetting a forgotten record does
nothing. Exits are computed strictly from current scopes, because a wrong exit would delete a record
the device should keep.

If the change touches more than `limits.maxScopeDelta` records (default 2 000), the server still
answers `resync_required`: past that size a full reload is cheaper.

## Consequences

- No protocol change: the delta uses the existing `op`, `snapshot` and `exit` items.
- Retired devices (ADR-0005) still resync.

## Update (2026-10-07): a delta stays pending until it is received

The PHP and Python mixed-server fleets found that a lost answer lost the delta for good: the server
saved the device's new read keys in the same transaction as the pull that carried the delta, so the
retried pull (same cursor) saw no change. The delta is now kept pending until the device shows it has
the answer. No client or protocol change.

Migration `0007_pending_scope_delta` adds two nullable columns to `devices`: `delta_keys text[]`
(the read keys **before** the pending delta) and `delta_cursor bigint` (the cursor the delta was
pulled from). Both are null or both are set. A pull from `cursor`, with the caller's normalized read
keys `read` (sorted, without duplicates), does this inside its repeatable-read transaction, after the
`needs_resync` check:

1. **Pending?** If `delta_keys` is set and `cursor > 0`:
   - `cursor <= delta_cursor`: a **retry** of the lost answer. `before = delta_keys`.
   - `cursor > delta_cursor`: the device received it (only an answer at or after the delta gives it
     a cursor above `delta_cursor`). `before = read_keys` (as without a pending delta).
2. Otherwise `before = read_keys` (or `[]` when null).
3. If `cursor > 0` and `before` differs from `read` (as sets): compute the delta from `before` to
   `read` from current scopes, as above. Over `maxScopeDelta`: answer `resync_required` and change
   nothing. Else send it, and save `read_keys = read`, `delta_keys = before`, and `delta_cursor =`
   the old `delta_cursor` on a retry, `cursor` otherwise.
4. If no delta is sent and one was pending (received, or a retry whose keys are back to
   `delta_keys`): save `read_keys = read`, `delta_keys = null`, `delta_cursor = null`.
5. A pull from `cursor = 0` saves `read_keys = read`, `needs_resync = false`, `delta_keys = null`,
   `delta_cursor = null` (it sends everything anyway).

`devices.cursor` (the compaction watermark) still moves to `greatest(cursor, request cursor)`; the
delta is computed from the records' full history (snapshots included), so compaction never makes a
pending delta incomplete. Two simultaneous pulls of one device collide on the `devices` row
(40001) and one is retried, as before.

**It terminates.** The answer to a delta pull carries a cursor above the request cursor whenever the
feed moved, and in practice even when it is idle: every pull writes the `devices` row and so takes a
transaction id, which moves the next pull's horizon past it. Only while an older transaction stays
open can the returned cursor equal the request cursor; the next pull then resends the delta once
more, which is harmless (ops and snapshots are idempotent, an exit for an absent record does
nothing), and the first pull whose cursor has moved clears it. Claims that change again while a
delta is pending are folded into one delta from `delta_keys`, so nothing is lost either way.
