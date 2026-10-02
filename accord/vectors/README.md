# Golden test vectors

Hand-written cases, with hand-worked expected results, that every Accord implementation must pass.
The TypeScript core reads them in `packages/core/src/vectors.test.ts`; any future port (Dart
first) must pass the same files, so implementations can never disagree.

## Format (version 1)

```jsonc
{
  "version": 1,
  "strategy": "set",
  "schema": {
    "dossier": { "name": "lww", "docs": "set", "visits": "counter", "status": "conflict" },
  },
  "cases": [
    {
      "name": "a concurrent add wins over a remove",
      "ops": [
        /* ops in the wire format: op_id, record, field, kind, hlc, value | by | element, deps */
      ],
      "expected": { "dossier:1": { "docs": ["cni.pdf"], "visits": 0 } },
    },
  ],
}
```

For each case, an implementation applies `ops` to an empty replica **in every order** (or, for
long cases, many orders), with duplicates, and must read exactly `expected`:

- fields with no value (`lww` or `conflict` never written) are absent;
- `counter` reads as an integer, `0` when never written;
- `set` reads as an array: numbers ascending, then strings by code unit;
- `conflict` reads as `{ "value": v }`, or `{ "conflicted": [{ "value", "opId" }, …] }` sorted by
  `opId`.

Never edit an existing case. Add new ones.
