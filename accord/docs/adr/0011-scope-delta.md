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
