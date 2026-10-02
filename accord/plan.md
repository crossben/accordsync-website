# Accord — offline-first sync that stays correct when the network lies

> Apps keep working with no connection. When it comes back, Accord passes every
> change along, and every device ends up with the same data.

This is the build plan, written for whoever implements Accord — a person or an
AI session. Read it end to end before writing code. Where it says **decide**,
record the decision in `docs/adr/` before moving on.

---

## 0. The name: Accord

The project is called **Accord**: every replica comes to an accord. (The
working name "Accord" was dropped because Meta's GraphQL client already owns it
in JavaScript.) Wordplay is welcome in docs and on the site, as long as it stays
light: "reach an accord", "in accord", "conflict() — some disagreements deserve
a meeting".

| Where | Name | Status (checked 2026-10-02) |
|---|---|---|
| npm packages | `accordsync` (unscoped) and `@accordsync/*` | unscoped name free; **claim the `@accordsync` npm org before M0 ends** |
| GitHub | `crossben/accordsync` (or an `accordsync` org) | `accordsync` free |
| pub.dev (later) | `accordsync` | check when the Dart client starts |

Use `accordsync` everywhere an identifier must be unique; use **Accord** in prose.
If the npm org is gone by the time you claim it, stop and ask the owner.

### Two folders

```
relay/            ← workspace folder (name kept for now)
├── plan.md       ← this file
├── website.md    ← plan for the website, built in parallel by another agent
├── app/          ← the Accord system (this plan)
└── website/      ← the Accord website (see website.md)
```

The website reads facts from `app/` and never modifies it.

---

## 1. What Accord is

In West Africa, field apps run where the network drops for minutes or days:
enrolment agents, waste collectors, shopkeepers, mobile clients. The owner has
re-solved offline sync by hand in several projects (CPI field work, Ekolo,
Komizi's Flutter app, ShopAgent). Each solution was partial: last write wins,
silently losing edits, or "please reconnect".

Accord solves it once:

```
device (SQLite) ─┐                         ┌─ PostgreSQL (truth)
device (SQLite) ─┼──►  Accord server  ──────┤
device (SQLite) ─┘   ops · clocks · merge   └─ change feed for other devices
```

- Apps write **locally first**, always. The network is never on the critical
  path of a user action.
- Changes are recorded as **operations**, not as row overwrites.
- On reconnect, operations sync both ways, and conflicting edits merge by
  **declared rules**, so every replica converges to the same state.
- A client library (TypeScript first, then Dart/Flutter) plus a self-hosted
  server, open source.
- **Audience: a public library for outside developers from day one.** API
  stability, docs, semver and an easy self-host matter as much as the owner's
  own apps (Komizi, CPI, Ekolo) adopting it.

### What Accord is not (say so in the README)

- **Not a database.** It syncs records defined by the app's schema; it is not a
  general query engine.
- **Not real-time collaboration on free text** in v1 (no shared rich-text
  editing). Fields are scalars, sets, counters and lists of references.
- **Not magic for business conflicts.** Two agents both "approving" a dossier
  is a business decision; Accord surfaces it as a conflict for the app instead of
  guessing.

---

## 2. Scope of version 1

- One server, PostgreSQL, single region.
- **TypeScript client** (browser + React Native, storage via SQLite/IndexedDB
  adapter). Dart/Flutter client comes after v1.
- Per-field merge strategies (§5.3), causality via hybrid logical clocks.
- Auth: the app's own JWT, verified by Accord; rules for who can read/write
  which records ("sync scopes").
- An example field app: two "agents" editing the same records offline.

Later, only after v1 is proven: Flutter client, partial sync by geography,
attachments (photos) with resumable upload, server-side hooks into Laravel/Spring
apps. **A small v1 that is provably correct beats a big one that mostly works.**

---

## 3. Stack

| Concern | Choice |
|---|---|
| Language | **TypeScript everywhere** (strict) — decided in ADR-0002: one pure merge core shared by client and server, proven once |
| Server runtime | Node 22 LTS, Hono (or Fastify) |
| Server DB | PostgreSQL 16, Kysely / plain SQL, versioned SQL migrations |
| Monorepo | pnpm workspaces; packages `core`, `client`, `server`, `simulator`; built with tsup |
| Protocol schemas | TypeBox → TS types + published JSON Schema from one source |
| Transport | HTTPS batch sync first (pull/push); WebSocket for "changes available" notifications |
| Client storage | Adapter interface: IndexedDB, SQLite via wa-sqlite (web) / op-sqlite (React Native) |
| Encoding | JSON for v1, versioned envelope; leave room for a binary format later |
| Clocks | Hybrid logical clocks (HLC) |
| Tests | Vitest; Testcontainers (Postgres) for the server |
| Tests (convergence) | Property-based tests with fast-check |
| Network simulation | Deterministic simulator: drop, delay, duplicate, reorder, partition |
| Observability | prom-client → Prometheus; sync lag, conflict counts, batch sizes |
| Packaging | Small Node Docker image, `docker-compose.yml` for local; npm packages under the chosen scope |
| CI | GitHub Actions: build, tests, convergence suite, contract check, image |
| Licence | Apache-2.0 — confirm with owner |

---

## 4. Repository layout

```
app/
├── README.md
├── LICENSE
├── protocol/               ← the sync protocol spec + JSON schemas; the contract
├── docs/
│   ├── adr/
│   ├── merge-rules.md      ← every strategy, with examples
│   └── runbook.md
├── packages/
│   ├── core/               ← pure merge core: HLC, ops, strategies (no I/O)
│   ├── client/             ← local-first client: storage adapters + transport
│   ├── server/             ← Node sync server (Hono + Postgres)
│   └── simulator/          ← deterministic network + devices simulator
├── vectors/                ← golden test vectors (JSON), the contract for future ports (Dart)
├── pnpm-workspace.yaml
├── examples/field-app/     ← two agents, one dossier, offline
├── load/k6/
└── docker-compose.yml
```

The merge core must be **pure** (no I/O, no clock reads, no randomness except
injected) and lives in one package, `packages/core`, imported by both client and
server. It is the part that gets the heaviest tests.

---

## 5. The core design

### 5.1 Operations, not snapshots

Every local write becomes an operation:

```json
{ "op_id": "dev-7f3a:1042", "record": "dossier:91", "field": "status",
  "kind": "set", "value": "submitted", "hlc": "1727871000123:0004:dev-7f3a",
  "deps": ["dev-7f3a:1041"] }
```

- `op_id` = device id + local sequence: unique, so applying an op twice is a no-op
  (idempotency — the same lesson as Yoon).
- Ops are stored in an **append-only log** on device and server. Current state is a
  projection of the log.
- Compaction: once every *live* device in a scope has acknowledged a point,
  older ops are folded into a snapshot. A device unseen for longer than
  `ACCORD_DEVICE_TTL` (default **30 days**, configurable per deployment) is
  considered retired and no longer holds compaction back. If it returns, it must
  do a full resync: it pushes its pending ops first (they merge against current
  state and may surface conflicts), then reloads from the snapshot.

### 5.2 Clocks

Hybrid logical clocks: physical time + logical counter + device id. They order
events consistently even when phone clocks are wrong (very common), and
`hlc` comparisons are total and deterministic. Detect and reject absurd clock
skew (> N hours into the future) instead of letting one bad phone win forever.

### 5.3 Merge strategies (declared per field in the schema)

| Strategy | Use for | Rule |
|---|---|---|
| `lww` | names, notes, simple scalars | highest HLC wins |
| `counter` | quantities collected, stock adjustments | sum of increments (PN-counter); never lost |
| `set` | tags, assigned agents | add-wins set (OR-set) |
| `conflict` | business-critical fields (status, approval, amount) | both values kept; the record is flagged `conflicted` and the app resolves it |

Schema example:

```ts
defineRecord("dossier", {
  client_name: lww(),
  documents: set(),
  visits: counter(),
  status: conflict(),   // never auto-resolved
});
```

`conflict()` is the honest answer to "what if two agents approve differently?":
Accord never guesses on money or legal status.

Ordered lists (`list_ref`, a sequence CRDT) are **out of v1**: most field-app
lists are really sets. They come back after v1 with their own proofs.

### 5.4 Sync protocol

- **Push:** the client sends ops not yet acknowledged, in batches, each batch
  with an id. The server applies them atomically, answers with the highest
  acknowledged op. If the connection drops mid-batch, resending the batch is
  harmless (idempotent ops).
- **Pull:** the client sends its per-scope cursor; the server returns ops since
  that cursor, in batches, plus a new cursor.
- **Notify:** optional WebSocket that only says "something changed in scope X".
  Data always moves through pull, so missing a notification loses nothing.
- **Resumable:** a 3-day-offline device with 10,000 ops syncs in pages; if it
  dies at page 7, it resumes at page 7.
- Protocol versioned; breaking change → new version, old one kept during a
  deprecation window.

### 5.5 Authorisation

- The app issues a JWT; Accord verifies it (JWKS) and reads the user id and roles.
- **Sync scopes** define which records a user can read and write (e.g. "dossiers
  of my portfolio", "routes of my zone"). The server filters every pull and
  rejects every pushed op outside the scope — server-side, never trusted to the
  client.
- A rejected op is returned to the client with a reason, and the client marks
  the local change as refused rather than silently diverging.
- **Scope exit:** when a record leaves a device's scope (e.g. a dossier is
  reassigned), the device pushes its pending ops for it first; the next pull
  carries a scope-exit marker and the device deletes its local copy. Any pushed
  op the server rejects as out of scope is reported to the app as refused —
  never dropped silently.

---

## 6. Proving it correct (this is the showcase)

1. **Convergence property test:** generate random sequences of devices going
   offline, editing, reconnecting, in random order with random network faults.
   After all messages are delivered, assert every replica has **identical**
   state. Thousands of cases per CI run, failures shrunk to a minimal example.
2. **Strategy laws:** for each merge strategy, test commutativity,
   associativity and idempotency (merge(a,b) = merge(b,a), etc.).
3. **No lost increments:** counters equal the sum of all increments ever made,
   under any delivery order.
4. **Conflicts are never auto-resolved:** fields marked `conflict()` always
   surface a conflict when edited concurrently.
5. **Deterministic simulator:** seeded runs that reproduce exactly, so a CI
   failure can be replayed locally with the same seed.
6. **Server under load:** k6 — N devices pushing/pulling; publish numbers with
   the hardware stated.

Write the convergence test **before** the first strategy is finished. It is the
definition of done for the whole project.

---

## 7. Milestones

**M0 — Skeleton:** name check (§0), repo layout, server boots with Postgres,
packages build, CI green, ADR-0001 (why Accord), ADR-0002 (TypeScript everywhere).

**M1 — Pure merge core:** HLC, op model, the strategies, strategy-law tests,
and golden test vectors in `vectors/` (JSON files the test suite reads; any
future port — Dart first — must pass the same vectors, so implementations can
never disagree).

**M2 — Simulator + convergence suite:** in-memory devices and server, network
faults, property-based convergence test passing.

**M3 — Real server:** push/pull API, Postgres op log, scopes + JWT auth,
idempotent batches, resumable paging, Testcontainers tests.

**M4 — Real client:** storage adapters, local-first writes, background sync,
retry with backoff, conflict API for the app, refused-op handling.

**M5 — Example + docs:** field-app example (two agents, offline, conflict on
status shown in the UI), `merge-rules.md`, protocol spec, README stating what
Accord is not.

**M6 — Proof & release:** compaction, metrics, k6 numbers, security checklist,
tagged `v0.1.0`, Docker image, npm package published.

---

## 8. Prior art to read (owner's own work)

- `../cpi` and `../../cpi/crm-monorepo` docs — the offline-first outbox ADR and
  field-agent context (read for the problem, do not copy code).
- `../komizi/app` — Flutter offline-first with drift, retry and cache.
- `../ekolo` — field collection in poor network conditions.
- `../yoon/yoon-app` — idempotency, append-only logs, honest README, ADR
  discipline, contract-first. Reuse the *style*.

Never copy credentials, `.env` values or real customer data from any repo.

---

## 9. Definition of done for v1

- [ ] Convergence property test passing in CI, with thousands of generated cases.
- [ ] Strategy laws proven for every strategy, with golden vectors checked in for future ports.
- [ ] Counters never lose an increment; `conflict()` fields never auto-resolve.
- [ ] A device offline for days syncs in resumable pages after reconnecting.
- [ ] Scopes enforced on the server, refused ops reported to the client.
- [ ] Field-app example runs end to end with two offline agents.
- [ ] Published load-test numbers.
- [ ] README states plainly what Accord is not.
- [ ] Tagged `v0.1.0`, npm package and Docker image published.

## 10. Working rules

- Tests first for the merge core; no "tests later".
- Every non-obvious decision → `docs/adr/NNNN-title.md`, never rewritten.
- English for code and docs; a French README section is welcome later.
- Keep the owner's portfolio honest: public claims must match the repo
  (numbers from the repo, no invented adoption, users or traffic).
