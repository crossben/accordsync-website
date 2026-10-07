# Sync protocol, version 1

Clients and the server talk over HTTPS with JSON. The machine-readable schemas are in
[`protocol/v1/`](../protocol/v1/), generated from the server's definitions; a test fails if they
drift. Every response carries `Accord-Protocol: 1`. A breaking change gets a new version, and the
old one stays available during a deprecation window.

## Authentication

Every sync request carries two headers:

| Header          | Value                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Authorization` | `Bearer <jwt>`, issued by your app. Accord verifies it against your JWKS and reads `sub` plus any claims your `access` function uses. |
| `Accord-Device` | The device id, `[A-Za-z0-9_-]{1,64}`. It is the prefix of every op id the device writes.                                              |

A device id is bound to the first user that uses it. Another user presenting it gets `403`.

## Push: `POST /v1/push`

```json
{
  "ops": [
    {
      "op_id": "dev-7f3a:1042",
      "record": "dossier:91",
      "field": "status",
      "kind": "assign",
      "value": "submitted",
      "deps": ["dev-7f3a:1041"],
      "hlc": "1727871000123:00004:dev-7f3a"
    }
  ]
}
```

Send the outbox **in write order**, at most 500 ops per request (configurable). Never send an op
numbered below the first op of a push that was already answered: the server relies on this to
forget old duplicates ([ADR-0010](adr/0010-concurrent-pushes.md)). The response:

```json
{
  "acked": ["dev-7f3a:1042"],
  "refused": [{ "op_id": "dev-7f3a:1043", "reason": "out of scope: you may not write dossier:12" }]
}
```

- **acked**: applied, now or by an earlier attempt. Remove them from the outbox. Resending a batch
  after a dropped connection is always safe: ops are identified by `op_id`.
- **refused**: never applied, with a reason (`op id already used` when this device reused an op id — see `device_seq` below; out of scope, clock too far ahead, does not fit the
  schema, malformed — including a string with a lone UTF-16 surrogate anywhere in the op, which the
  server cannot store —, belongs to another device). Roll them back locally and tell the app
  ([ADR-0006](adr/0006-refused-ops-roll-back.md)).

An existing record accepts a write if its current scope keys overlap the caller's write keys. A
new record accepts it if the keys it would have after the write overlap them.

## Pull: `GET /v1/pull?cursor=<n>&limit=<n>`

Start with `cursor=0`. The cursor is opaque: store it and send it back. The response:

```json
{
  "items": [
    { "type": "op", "op": { "op_id": "…" } },
    { "type": "exit", "record": "dossier:12" }
  ],
  "cursor": 4812,
  "has_more": true,
  "device_seq": 37
}
```

- Apply every `op` item (applying an op twice is a no-op).
- `snapshot`: a compacted record. Replace your copy of the record with it, then re-apply your own
  unpushed ops for that record ([ADR-0008](adr/0008-snapshots.md)). It always comes before any later
  op of that record.
- `exit`: the record left your scope. Delete the local copy
  ([ADR-0004](adr/0004-scope-exit.md)). Before pulling, always push your outbox first, so your
  pending edits to it are either accepted or refused.
- When a record **enters** your scope, its whole history arrives in the same page.
- Store `cursor` after applying the page, and send it back next time. While `has_more` is true, pull
  again. A device that dies mid-way resumes from the last stored cursor; at worst it receives a
  page twice, which is harmless.

`device_seq` is the highest op number the server has applied from this device. Number new ops above
it: a device that lost its storage (a reinstall keeping its device id) must never reuse an op id.

If your read scopes changed since your last pull (new JWT claims), the page starts with the history
of every record that entered them and an `exit` for every record that left. Only for a very large
change (or a device back after the retirement TTL) does the server answer:

```json
{ "resync_required": true }
```

Push your outbox, delete local data, and pull again from `cursor=0`.

## Errors

| Status | Meaning                                                                                      |
| ------ | -------------------------------------------------------------------------------------------- |
| `429`  | Rate limit exceeded: wait `Retry-After` seconds, then retry                                  |
| `400`  | Malformed request: bad JSON, missing `Accord-Device`, an op without an `op_id`, too many ops |
| `401`  | Missing or invalid token                                                                     |
| `403`  | The device id belongs to another user                                                        |
| `500`  | Server error. Retry with backoff; pushes are idempotent.                                     |

Errors are JSON: `{ "error": "<reason>" }`.

## Health: `GET /health`

`200 {"status":"ok","protocolVersion":1}`, or `503` when the database is unreachable. No
authentication.
