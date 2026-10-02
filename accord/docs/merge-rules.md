# Merge rules

Every field declares how concurrent edits merge. Whatever order ops arrive in, and however many
times, every replica reads the same value. The [golden vectors](../vectors/) pin each rule down
with exact cases.

| Strategy   | Use for                                 | Rule                                                                         | Example                                                                |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `lww`      | names, notes, simple scalars            | the write with the highest clock wins                                        | A writes "Awa", B later writes "Awa Diop" → "Awa Diop" on every device |
| `counter`  | quantities collected, stock adjustments | the sum of every increment; none is lost                                     | A adds 3, B adds −1 offline → 2                                        |
| `set`      | tags, assigned agents, documents        | add-wins: a remove only removes the adds its writer had seen                 | B removes "cni.pdf" while C adds it again → "cni.pdf" stays            |
| `conflict` | status, approval, amounts               | concurrent values are all kept and the field is flagged; the app resolves it | A approves, B rejects → both values, flagged                           |

```ts
import { conflict, counter, defineSchema, lww, set } from '@accordsync/core';

const schema = defineSchema({
  dossier: { client_name: lww(), documents: set(), visits: counter(), status: conflict() },
});
```

## Clocks

Ops are ordered by hybrid logical clocks: physical time, a counter, and the device id. They give
a total order even when phone clocks are wrong. An op whose clock is more than 24 hours
(configurable) ahead of the receiver is refused, so one phone with a wrong date cannot win every
`lww` merge forever.

## `conflict()` in detail

Accord never guesses on money or legal status. Some disagreements deserve a meeting.

- Each write lists the values its writer could see. It replaces exactly those.
- A write made without seeing another one is concurrent with it, so both values are kept and the
  field reads `{ conflicted: [...] }`.
- **Resolving is a write**: the app writes the chosen value while seeing every conflicting value.
  An edit made somewhere else that the resolver had not seen is not erased; it keeps the field
  conflicted until someone resolves it too ([ADR-0003](adr/0003-merge-strategies-v1.md)).

| Situation                                                  | Result                                 |
| ---------------------------------------------------------- | -------------------------------------- |
| A writes "draft"; B, having synced, writes "submitted"     | `{ value: "submitted" }`               |
| A writes "approved", B writes "rejected", both offline     | `{ conflicted: [approved, rejected] }` |
| A resolves to "approved" while C, offline, wrote "on_hold" | `{ conflicted: [approved, on_hold] }`  |

## Not in v1

Ordered lists (a sequence CRDT) come after v1. Most field-app lists are really sets.
