# Accord server conformance suite

A black-box HTTP suite that checks every server behaviour Accord clients rely on: push acks and
retries, reused op ids, each refusal reason, write scopes for new and existing records, read-only
access, paging and `has_more`, `device_seq`, entering records and exits, scope deltas and
`resync_required`, retired devices, snapshots after compaction, concurrent pushes, auth (`401`),
device ownership (`403`), limits (`400`, `413`, `429`), the `Accord-Protocol` header, and that every
response matches the published schemas in [`protocol/v1/`](../protocol/v1/).

The tests use HTTP only. They never import server code, so the same suite runs against the
TypeScript server, the PHP port and the Python port.

## Run it against the reference server

```sh
pnpm conformance        # from the repository root (Docker required)
```

This starts PostgreSQL 16 (Testcontainers), starts [`reference-server.ts`](reference-server.ts)
(`@accordsync/server` from this workspace, configured with the profile) as a separate process on
free ports, runs the suite, and stops both.

## Run it against another server

The server under test must:

1. be configured with the **conformance profile** ([PROFILE.md](PROFILE.md),
   [profile.json](profile.json)) on an empty PostgreSQL database;
2. expose the **control API** (token, reset, compact, age-device, hold-record, held, release) on a second, test-only port, as
   described in PROFILE.md.

Then point the suite at it:

```sh
ACCORD_URL=http://localhost:8787 ACCORD_CONTROL_URL=http://localhost:8788 \
  pnpm --filter @accordsync/conformance test
```

The suite reads only these two variables. Tests reset the database before each test and run one at
a time; never point it at a database you care about.

To run the reference server by hand (for example to debug a test):

```sh
cd conformance
ACCORD_DATABASE_URL=postgres://… ACCORD_PORT=8787 ACCORD_CONTROL_PORT=8788 pnpm reference
```

## Layout

| File                       | What                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `PROFILE.md`               | The server definition and control API every implementation provides    |
| `profile.json`             | The same, machine-readable; the suite reads its limits from it         |
| `reference-server.ts`      | The TypeScript reference: `@accordsync/server` plus the control API    |
| `global-setup.ts`          | Starts PostgreSQL and the reference unless `ACCORD_URL` is set         |
| `test/accord.ts`           | A tiny HTTP client: devices, wire ops, schema and header checks        |
| `test/http.test.ts`        | Health, `Accord-Protocol`, 400/401/403/413/429, error bodies           |
| `test/push.test.ts`        | Acks, retries, reused ids, malformed ops, every refusal reason, limits |
| `test/scopes.test.ts`      | Write scopes for new and existing records, read-only access            |
| `test/pull.test.ts`        | Paging, order, wire shape, entering history, exits, scope deltas, TTL  |
| `test/compaction.test.ts`  | Snapshots, retries of compacted ops, `device_seq` after compaction     |
| `test/concurrency.test.ts` | Parallel pushers and pullers: every acked op reaches every reader once |

Tests marked `it.fails` document a known bug in the reference server: they must fail until it is
fixed, and a port should implement the correct behaviour (the test body).
