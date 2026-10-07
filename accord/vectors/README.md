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

## Random vectors

`random/cases.json` is generated, not hand-written: seeded scenarios with awkward values
(integer-like keys, `\u2028`, lone surrogates, `1e+21`, mixed-case device ids), each with its ops and
the canonical snapshot this core reads. Other implementations must reproduce every snapshot byte for
byte. `packages/core/src/random-vectors.test.ts` regenerates the file and fails if it differs;
rewrite it with `ACCORD_WRITE_VECTORS=1 pnpm --filter @accordsync/core test`.

## op_hash vectors

`op-hash/op-hash.json` pins the hash a server stores for each op folded by compaction
(`compacted_ops.op_hash`, ADR-0010): SHA-256, lowercase hex, of the UTF-8 bytes of the canonical
JSON of the op's wire form. Every server shares the database, so every server must compute it byte
for byte the same.

```jsonc
{
  "version": 1,
  "cases": [
    { "name": "…", "op": {/* wire op */}, "canonical": "{\"deps\":[],…}", "hash": "<64 hex>" },
  ],
}
```

For each case an implementation parses `op` (one case holds a literal `-0`, which must be read as
the number zero and written `0`), decodes and re-encodes it as its server stores it (unchanged for
these ops), and must produce exactly `canonical` and `hash`. Cases cover every op kind, `deps`
present and absent, non-ASCII, an emoji, U+E000/U+FFEF keys, integer-like keys (JavaScript order:
array-index keys first, ascending), `1e+21`, `1e-7`, `-0`, nested objects, `{}` vs `[]`, `null` and
escapes. `packages/server/test/op-hash-vectors.test.ts` regenerates the file and fails if it differs;
rewrite it with `ACCORD_WRITE_VECTORS=1 pnpm --filter @accordsync/server test`. It lives in a
subfolder so the strategy vectors above stay the only top-level files.
