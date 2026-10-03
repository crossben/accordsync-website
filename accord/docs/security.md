# Security checklist

What Accord enforces, where, and what stays your responsibility when you deploy it. Each line
names the code or test that backs it.

## Enforced by the server

| Concern                | How                                                                                                                                                                                                  | Backed by                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Authentication         | Every sync request needs a JWT, verified against your JWKS (or a dev HS256 secret, algorithm pinned). Tokens without `sub` are refused.                                                              | `src/auth.ts`, `test/sync.test.ts`       |
| Authorisation on read  | Every pull is filtered by the caller's read keys, computed on the server from verified claims.                                                                                                       | `src/sync.ts` `pull`, scope tests        |
| Authorisation on write | Every pushed op is checked against the record's current scope keys (or, for a new record, the keys it would have). Refused ops never touch the feed.                                                 | `src/sync.ts` `check`, refusal tests     |
| Device impersonation   | A device id is bound to its first user (403 for anyone else), and a device can only push ops stamped with its own id.                                                                                | `touchDevice`, device tests              |
| Replay / duplicates    | Ops are identified by id; a re-push of the same op is acknowledged and never applied twice, including ops already compacted. The same id with other content is refused, never silently acknowledged. | `src/sync.ts`, retry and reinstall tests |
| Clock abuse            | Ops whose clock is more than 24 h (configurable) ahead of the server are refused, so a wrong or malicious clock cannot win every merge.                                                              | `check`, skew test                       |
| Tampering with history | The feed is append-only: a PostgreSQL trigger refuses updates and deletes (compaction alone may delete, inside its own transaction).                                                                 | migration `0002`, append-only test       |
| Input validation       | Request envelopes are checked against the published JSON Schema; each op is decoded strictly and checked against your schema.                                                                        | `src/protocol.ts`, `decodeOp`            |
| Request rate           | Per device (600/min) and per user (1 800/min) by default, per server process; 429 with `Retry-After`.                                                                                                | `src/ratelimit.ts`, rate-limit test      |
| Request size           | Bodies over 5 MiB get 413; at most 500 ops per push and 1000 items per pull page (all configurable).                                                                                                 | `bodyLimit`, limit tests                 |
| SQL injection          | All queries are built with Kysely; raw fragments use bound parameters only.                                                                                                                          | `src/sync.ts`, `src/compact.ts`          |
| Error leakage          | Unexpected errors return `{"error":"internal error"}`; details go to the server log only.                                                                                                            | `app.onError`                            |
| Metrics exposure       | `/metrics` is off unless you set a token; the token is compared in constant time.                                                                                                                    | `metrics` test                           |
| Container              | Runs as the unprivileged `node` user, with a healthcheck.                                                                                                                                            | `Dockerfile`                             |
| Dependencies           | `pnpm audit --prod` reported no known vulnerabilities at release time.                                                                                                                               | CI                                       |

## Your responsibility when deploying

- [ ] **Use JWKS, not the dev secret.** `ACCORD_DEV_SECRET` in `docker-compose.yml` is public. The
      server warns at startup when it runs with a shared secret.
- [ ] **Set `issuer` and `audience`** in `auth`, so tokens issued for another app are refused. The
      server warns when they are missing.
- [ ] **Terminate TLS** in front of Accord (Caddy, nginx, a load balancer). Tokens travel in
      headers.
- [ ] **Rate limits** are built in since v0.2 (per device and per user, per server process; 429 with
      `Retry-After`). With several workers or servers, add a shared limit at the proxy too.
- [ ] **Keep token lifetimes short.** Accord re-reads claims on every request, so a change of
      access takes effect at the next sync; a revoked user keeps access until their token expires.
- [ ] **Write scope functions carefully.** They are your access policy. Test them like any
      authorisation code. A scope function that throws refuses the write.
- [ ] **Restrict CORS** to your app's origins, or leave it off for native apps.
- [ ] **Protect the database.** The feed holds every accepted write. Back it up; restrict network
      access to it.
- [ ] **Data on devices is not encrypted by Accord.** IndexedDB and SQLite files are as safe as the
      device. Use the platform's encrypted storage (e.g. SQLCipher with op-sqlite) for sensitive
      data.

## Known limits of v0.1

- Rate limits are counted per server process, not shared between workers or servers.
