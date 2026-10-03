# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/crossben/accordsync/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/crossben/accordsync/releases/tag/v0.1.0
