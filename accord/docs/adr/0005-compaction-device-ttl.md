# ADR-0005: Log compaction and retired devices

- Status: accepted
- Date: 2026-10-02

## Context

Ops can be folded into a snapshot once every device in a scope has acknowledged them. A device
that never returns (lost, broken, uninstalled) would block compaction forever.

## Decision

- Compaction waits only for **live** devices. A device unseen for longer than
  `ACCORD_DEVICE_TTL` (default **30 days**, configurable per deployment) is retired.
- A retired device that returns must do a full resync. It first pushes its pending ops, which merge
  against the current state (and may surface conflicts), then reloads from the snapshot.

## Consequences

- The op log stays bounded in deployments with lost phones.
- Ops from a device that returns after the TTL are still merged; only its local history is replaced.
