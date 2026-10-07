# Conformance profile

The server definition every Accord server implementation configures to run the conformance suite,
and the control API it exposes for the suite. The machine-readable version is
[`profile.json`](profile.json) (the suite reads its limits from there); the reference
implementation is [`reference-server.ts`](reference-server.ts).

Limits are deliberately small so that limit behaviour is reached in a few requests.

## Schema

One record type, `dossier`:

| Field         | Strategy   |
| ------------- | ---------- |
| `agent`       | `lww`      |
| `zone`        | `lww`      |
| `client_name` | `lww`      |
| `status`      | `conflict` |
| `visits`      | `counter`  |
| `docs`        | `set`      |

## Scope function

A dossier's scope keys, from its current fields:

- `agent:<agent>` when `agent` is a string;
- `zone:<zone>` when `zone` is a string;
- no key for a missing (or non-string) field. A dossier with neither has no keys: nobody may create
  it.

## Access from JWT claims

| Claim            | Type             | Grants                                 |
| ---------------- | ---------------- | -------------------------------------- |
| `sub`            | string           | read and write `agent:<sub>`           |
| `zones`          | array of strings | read and write `zone:<z>` for each `z` |
| `readonly_zones` | array of strings | read only `zone:<z>` for each `z`      |

Missing or non-array `zones` / `readonly_zones` grant nothing; non-string entries are ignored.

## Auth

HS256 shared secret `accord-conformance-secret-at-least-32-bytes`, issuer `accord-conformance`
(tokens with another issuer are rejected). No audience. Tokens need `sub` and `exp`.

## Limits

| Setting          | Value                        | Why                                                     |
| ---------------- | ---------------------------- | ------------------------------------------------------- |
| `maxPushOps`     | 20                           | 21 ops get `400` without building a large body          |
| `maxPullLimit`   | 10                           | `?limit=1000` is clamped to 10 after 15 pushes          |
| `maxScopeDelta`  | 3                            | 4 records entering a scope give `resync_required`       |
| `maxBodyBytes`   | 16 384                       | a 16 KiB string gives `413`; 20 normal ops fit easily   |
| `maxSkewMs`      | 60 000                       | an op stamped 2 minutes ahead is refused                |
| rate, per device | 6 000/min (100/s), burst 100 | 150 simultaneous requests get `429`; normal tests never |
| rate, per user   | 12 000/min, burst 200        | never reached by the suite on its own                   |
| `minOps`         | 2                            | compaction folds any record with 2 ops or more          |
| `deviceTtlDays`  | 30                           | a device aged 31 days must resync, 29 days must not     |
| `intervalMs`     | 0 (no background compaction) | the suite compacts only through `POST /compact`         |

Rate-limit state must be cleared by `POST /reset` (the reference recreates its request handler).
Other settings keep the server's defaults (for the TypeScript server: `maxConcurrentPushes` 8).

## Control API

A second HTTP port, for tests only (never expose it). Responses are JSON; errors are
`{ "error": "..." }` with a 4xx or 500 status.

| Route                                  | Does                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /token?sub=&zone=&readonly_zone=` | `{ "token": "<jwt>" }`: HS256 with the profile secret and issuer, `sub`, `iat`, `exp` one hour ahead. Each `zone` (repeatable) goes into the `zones` claim, each `readonly_zone` into `readonly_zones`; a claim is omitted when its parameter is absent. `exp_in=<seconds>` sets `exp` relative to now (negative: already expired). |
| `POST /reset`                          | Empties every Accord table (`feed`, `records`, `devices`, `compacted_ops`), restarting identities, and clears rate-limit state. `{}`.                                                                                                                                                                                               |
| `POST /compact`                        | Runs compaction once, now. Returns `{ "watermark", "records", "opsFolded", "tombstonesPruned" }` (numbers); the suite checks `records` and `opsFolded`.                                                                                                                                                                             |
| `POST /age-device?device=&days=`       | Sets the device's last-seen time to `days` days ago, as if it had been offline that long. `404` for an unknown device. `{}`.                                                                                                                                                                                                        |

Every implementation must also provide these three routes, used by the pull-horizon test
(ADR-0010). They act on the database only, so they are the same SQL for every server:

| Route                       | Does                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /hold-record?record=` | On a database connection of its own: `begin`, then `select record from records where record = $1 for update`, and answers `{}` once the row is locked, keeping the transaction open. `404` for an unknown record, `409` if a record is already held. Pushes writing that record then wait (after creating any new record rows of the batch). |
| `GET /held`                 | `{ "waiting": n }`: how many sessions the held transaction is blocking, `select count(*) from pg_stat_activity where <holder pid> = any(pg_blocking_pids(pid))` (`0` when nothing is held).                                                                                                                                                  |
| `POST /release`             | Rolls the held transaction back and answers `{}` once it has ended; `{}` when nothing is held. `POST /reset` releases it too.                                                                                                                                                                                                                |

## Refusal reasons

Clients show refusal reasons to people and match some of them. The suite checks:

- exactly `out of scope: you may not write <record>`;
- exactly `op belongs to device <device>` (an op whose op id names another device);
- starts with `op id already used` (an id this device already used for other content, or numbered at
  or below its `device_seq`);
- starts with `malformed op` (an op that cannot be decoded but has a string `op_id`);
- contains `unknown record type`, `unknown field`, `does not apply` (op kind vs. field strategy),
  `ahead of the server` (clock skew).
