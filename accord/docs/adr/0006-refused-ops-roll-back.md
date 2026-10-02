# ADR-0006: Refused ops are rolled back on the device that wrote them

- Status: accepted
- Date: 2026-10-02
- Extends: [ADR-0004](0004-scope-exit.md)

## Context

The server refuses ops it will not apply: writes outside the user's scope (ADR-0004), clocks too
far ahead, ops that do not fit the schema. The device that wrote such an op has already applied it
locally (local-first). If it kept it, its state would differ from every other replica forever. The
convergence simulator showed this directly.

## Decision

When the server refuses an op, the client:

1. rebuilds its local state from its op log without the refused op (`LocalWriter.discard`);
2. reports the refusal, with the server's reason, to the app.

Op ids and clocks are never rewound, so a refused op id is never reused.

## Consequences

- Replicas converge to exactly the set of ops the server accepted. The convergence suite asserts
  that every op written is either accepted or refused and rolled back.
- The user may see a local edit disappear. The app is told why and decides how to show it.
- Rebuilding is linear in the local log size. Compaction (ADR-0005) bounds the log.
