# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-10-07

### Added

- `conformance/`: a black-box HTTP conformance suite every Accord server must pass (`pnpm
conformance`), with the profile and control API other implementations configure.
- `vectors/op-hash/op-hash.json`: golden vectors pinning `op_hash` (canonical JSON and SHA-256 of
  compacted ops), regenerated and checked by `@accordsync/server`'s tests.
- Conformance: a deterministic test of ADR-0010's pull horizon, using new control routes
  (`/hold-record`, `/held`, `/release`) every implementation must provide.

### Fixed

- `@accordsync/server`: a different op reusing the id of an op folded by compaction (a device that
  lost its storage and pushed before its first pull) was acknowledged and silently dropped. Folded
  ops now keep a hash of their content (migration `0006_compacted_op_hash`), and such a push is
  refused with `op id already used`.
- `@accordsync/server`: two simultaneous pulls from one device could answer 500 (PostgreSQL
  serialization conflict); the pull is now retried.
- `@accordsync/server`: a lost pull answer carrying a scope delta (ADR-0011) was never sent again,
  so the device missed the history of records entering its scope (or their exits) for good. The
  delta now stays pending until the device pulls from a later cursor (migration
  `0007_pending_scope_delta`); a retry at the same cursor receives it again. No client change.
- `@accordsync/server`: an op containing a lone UTF-16 surrogate (in a value, set element, id or
  key) made the whole push fail with 500, and the client retried it forever. It is now refused as
  `malformed op`, and the rest of the batch applies.

## [0.2.0] - 2026-10-03

### Added

- `@accordsync/react`: `AccordProvider`, `useRecord`, `useRecords`, `useConflicts`, `useSyncStatus`;
  components re-render only when what they read changed.
- `create-accord`: `npm create accord my-app` scaffolds a schema, server config, PostgreSQL compose
  file, development tokens and a client that writes offline and syncs.
- `docs/scopes.md`: five scope patterns with tests (`examples/scopes`), and the rules that keep
  scopes correct. `docs/react-native.md`: op-sqlite storage and sync around the app lifecycle.
- React Native: device ids fall back to `crypto.getRandomValues` (react-native-get-random-values);
  without a secure random source, opening fails with an explanation instead of crashing.

- Concurrent pushes (ADR-0010): pushes lock only the records they write; pulls read the feed in
  transaction order up to the oldest running transaction, so no op is ever skipped.
- `ACCORD_WORKERS`: several server processes on one port (`auto` = one per CPU).
- Rate limits per device and per user (`rateLimit` in `defineServer`; 429 with `Retry-After`).
- A change of read scopes is sent as a delta instead of a full resync (ADR-0011); `limits.maxScopeDelta`.
- Pull responses carry `device_seq`, the highest op number applied from the device.
- `load/run.sh` and v0.2 load results: about 3 000 ops/s with 4 workers on the reference laptop.

### Changed

- Sets: re-adding an element replaces the tags its writer saw (`add` ops may carry `deps`), so a
  set's state no longer grows with repeated adds. Older clients' adds still work.
- Clients must push their outbox in write order (protocol rule, ADR-0010).
- The server image installs only the server's dependencies.

### Fixed

- A device that lost its storage and kept its device id could reuse op ids, and its new writes were
  acknowledged as duplicates and lost. Op counters now advance past the device's own ops and
  `device_seq`, and a reused id is refused instead of acknowledged.

### Upgrade notes

- Migration 0005 sends every device back to cursor 0 once (`resync_required`), because cursors now
  count transaction positions.
- Compacted-op entries are pruned once their device has pushed past them.

## [0.1.0] - 2026-10-02

First release.

### Added

- M1 pure merge core (`@accordsync/core`): hybrid logical clocks with skew refusal, the op
  model and wire format, four strategies (`lww`, `counter`, `set`, `conflict`), `Replica` and
  `LocalWriter`.
- Property-based strategy-law tests against reference models, and golden vectors in `vectors/`.
- `docs/merge-rules.md`.
- M2 deterministic simulator (`@accordsync/simulator`): in-memory server and devices, push/pull
  with paging, retries and timeouts, and a network that drops, delays, duplicates and reorders
  messages and partitions devices. Every run replays exactly from its seed.
- Convergence suite: under random faults, every device and the server converge to the state of
  exactly the accepted ops; counters equal the sum of accepted increments.
- `LocalWriter.discard`: refused ops are rolled back locally (ADR-0006).
- M3 sync server (`@accordsync/server`): `accord serve` with a TypeScript config
  (`defineServer`: schema, scope functions, access from JWT claims), JWT verification through JWKS
  (or a dev HS256 secret), `POST /v1/push` and `GET /v1/pull` with paging, scope entry history,
  scope exit markers and `resync_required` (ADR-0007).
- PostgreSQL append-only feed (enforced by a trigger), device-to-user binding, serialized pushes so
  cursors never skip an op.
- `docs/protocol.md` and generated JSON Schemas in `protocol/v1/`.
- M4 client (`@accordsync/client`): `AccordClient` with local-first writes, `sync()` and background
  sync with exponential backoff and jitter, conflict API (`conflicts`, `resolve`), events
  (`change`, `refused`, `synced`, `resync`, `error`), refused-op rollback, scope exit, resync that
  keeps unpushed edits, and restart without op id reuse.
- Storage adapters: IndexedDB, SQLite (any driver: wa-sqlite, op-sqlite, `node:sqlite`) and memory,
  with one shared contract test suite.
- `docs/client.md`.
- M5 field-app example (`examples/field-app`): two agents edit a dossier offline in two browser
  tabs; counters add up, sets merge, and a status conflict is shown for them to resolve.
- Server: `cors` option on `defineServer` for browser apps on another origin.
- M6 log compaction (ADR-0008): records every live device has fully pulled are folded into
  snapshots; devices retired after `deviceTtlDays` (30) resync when they return; `accord compact`,
  and hourly compaction under `accord serve`. Clients store snapshots in every storage adapter.
- Server keeps each record's current state, so push cost no longer grows with history (ADR-0009).
- Prometheus metrics at `/metrics` (token-protected): push outcomes and batch sizes, pull pages and
  items, request durations, feed head, live devices, sync lag, ops folded by compaction.
- Security: request body limit (413), constant-time metrics token check, startup warnings for dev
  auth and missing issuer/audience; `SECURITY.md` and `docs/security.md`.
- k6 load test (`load/k6/sync.js`) and published results: about 1 000 ops/s on one laptop, pull
  p95 ≤ 20 ms, no failed requests up to 200 devices (`load/README.md`).
- Pushes queue in-process before taking a database connection; `ACCORD_DB_POOL` sets the pool size.
- Release workflow: a `v*` tag publishes the npm packages (with provenance) and the server image to
  ghcr.io.
- M0 skeleton: pnpm monorepo (`core`, `client`, `server`, `simulator`), server health endpoint
  with PostgreSQL migrations, Docker image, Compose file, CI.

[Unreleased]: https://github.com/crossben/accordsync/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/crossben/accordsync/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/crossben/accordsync/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/crossben/accordsync/releases/tag/v0.1.0
