# ADR-0003: Four merge strategies in v1, and conflicts resolved by operations

- Status: accepted
- Date: 2026-10-02

## Decision

v1 ships four per-field strategies. Each one's `apply` is commutative, associative and idempotent.

| Strategy   | Rule                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| `lww`      | highest HLC wins                                                                  |
| `counter`  | PN-counter keyed by device: increments and decrements are never lost              |
| `set`      | OR-set: a concurrent add wins over a remove                                       |
| `conflict` | every concurrent value is kept; more than one value means the field is conflicted |

**Ordered lists (`list_ref`) are out of v1.** They need a sequence CRDT, the hardest strategy to
prove, and most field-app lists (assigned agents, documents) are really sets. They return after
v1 with their own proofs.

**Resolving a conflict is itself an operation.** A `resolve` op lists, in `deps`, the op ids of the
values it supersedes, and clears only those. A concurrent edit the resolver had not seen survives
and keeps the field conflicted, so a third offline edit is never lost under a resolution.

## Consequences

- The app gets a conflict API: list conflicted fields, read all values, write a resolution.
- `conflict()` fields are never auto-resolved; tests assert it.
