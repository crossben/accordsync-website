# Load test

`k6/sync.js` simulates field devices. Each virtual user is one device of one agent: it pushes a
batch of 10 ops (counter increments, name edits, document adds), then pulls a page. Agents share 10
zones, and half of every batch goes to the zone's shared dossier, so pulls carry other devices'
ops and pushes contend on the same records, as in a real field team.

## Run it

```sh
docker compose up -d --build
load/run.sh 100               # fresh database, rate limits off, 60 s, prints a summary
WORKERS=4 load/run.sh 200     # several server processes
```

## Results: v0.2

Measured on 2026-10-03, same laptop and setup as v0.1 below (one machine, Docker Compose,
PostgreSQL 16 defaults, k6 on the same machine, 60 s per run, fresh database, devices pushing and
pulling non-stop). New in v0.2: concurrent pushes
([ADR-0010](../docs/adr/0010-concurrent-pushes.md)), sets that no longer grow when an element is
re-added, and `ACCORD_WORKERS` to run several server processes. Raw summaries:
`results/vus-<devices>-w<workers>.json`.

| Devices | Workers | Ops accepted/s | Push p50 | Push p95 | Push p99 | Pull p50 | Pull p95 | Failed requests |
| ------: | ------: | -------------: | -------: | -------: | -------: | -------: | -------: | --------------: |
|      50 |       1 |          1 840 |   240 ms |   297 ms |   336 ms |    33 ms |    46 ms |             0 % |
|     100 |       1 |          1 594 |   577 ms |   658 ms |   798 ms |    37 ms |    52 ms |             0 % |
|     200 |       1 |          1 682 | 1 099 ms | 1 483 ms | 2 344 ms |    35 ms |    55 ms |             0 % |
|      50 |       4 |          2 998 |   129 ms |   194 ms |   234 ms |    31 ms |    50 ms |             0 % |
|     100 |       4 |          2 860 |   301 ms |   437 ms |   494 ms |    34 ms |    56 ms |             0 % |
|     200 |       4 |          3 039 |   606 ms |   808 ms |   909 ms |    33 ms |    56 ms |             0 % |

### What changed, and what this means

- **With 4 workers, about 3 000 ops/s, roughly 3× v0.1** on the same machine, and push latency at
  200 devices fell from 2.3 s to 0.8 s (p95).
- **With one worker, the Node process is the limit**, not the database: during the v0.2 runs
  PostgreSQL's connections were mostly waiting for the server, with no lock waits. That is why
  workers help.
- **Pulls got a little slower** (p95 about 50 ms instead of 15–20 ms): each pull now also computes
  the transaction horizon, and pulls compete with concurrent pushes for the database.
- **The set fix mattered most under contention:** before it, re-adding the same documents grew each
  shared record's state to about 700 tags, and 200 devices on one worker managed 747 ops/s. After it,
  1 682.
- **Run-to-run variance on a laptop is large.** An earlier v0.2 run at 50 devices and one worker
  reached 2 468 ops/s, against 1 840 in the table. Treat these as orders of magnitude, and measure on
  your own hardware.

## Results: v0.1.0

Measured on 2026-10-02 with `v0.1.0` code. Raw k6 summaries: [`results/v0.1-vus-*.json`](results/).

**Hardware and setup:** one laptop, Intel Core i7-11800H (8 cores / 16 threads, 2.3 GHz), 31 GiB
RAM, Linux 7.0. Docker Compose as in this repository: one Accord server process (Node 24) and
PostgreSQL 16 with its default configuration, in Docker with 16 CPUs and 8 GB available. k6 ran on
the same machine. Each run: 60 s, fresh database, batches of 10 ops, pull pages of up to 500 items.
Devices push and pull **continuously, with no pause** between rounds: a worst case.

| Devices | Ops accepted/s | Push p50 | Push p95 | Push p99 | Pull p50 | Pull p95 | Failed requests |
| ------: | -------------: | -------: | -------: | -------: | -------: | -------: | --------------: |
|      50 |          1 004 |   479 ms |   548 ms |   640 ms |    11 ms |    14 ms |             0 % |
|     100 |          1 033 |   975 ms | 1 049 ms | 1 076 ms |    11 ms |    15 ms |             0 % |
|     200 |            984 | 1 951 ms | 2 258 ms | 2 463 ms |    13 ms |    20 ms |             0 % |

### What this means

- **Throughput is capped at about 1 000 ops/s** (about 100 pushes of 10 ops per second) on this
  machine. Pushes are serialized on purpose, so a pull cursor can never skip an op
  ([ADR-0007](../docs/adr/0007-server-feed-and-scopes.md)). More devices do not add throughput;
  they wait in the push queue, which is why push latency grows with the number of devices.
- **Pulls stay fast under load** (p95 ≤ 20 ms), because they do not wait for pushes.
- **For a field team:** a device that syncs every 30 seconds with 10 changes needs about 0.33 ops/s,
  so this setup carries roughly 3 000 such devices at the throughput cap. Devices that sync less
  often, or with fewer changes, stretch that further. These are estimates from the table above, not
  a separate measurement.
- Numbers come from one machine and a synthetic workload. Your hardware, PostgreSQL tuning and data
  shapes will differ: run the script on your own setup before relying on them.

### Before the fixes

The first runs found two problems, fixed before release
([ADR-0009](../docs/adr/0009-server-record-state.md)): pushes re-read each record's whole history,
and queued pushes held every database connection, so pulls waited behind them (pull p95 was 311 ms
at 50 devices and 1 521 ms at 200). Those summaries are kept as `results/before-*.json`.
