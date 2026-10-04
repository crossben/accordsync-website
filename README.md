# Accord

**Offline-first sync that stays correct when the network lies.**

Apps keep working with no connection. When it comes back, every device ends up with the same data:
changes merge by rules you declare per field, counters never lose an increment, and conflicting
decisions are kept for your app to settle instead of being guessed.

Website and docs: **[accord.benhattab.pro](https://accord.benhattab.pro)** ·
Source: **[crossben/accordsync](https://github.com/crossben/accordsync)**

## Get started

```sh
npm create accord my-app
```

This creates a working project: a schema, a server configuration, PostgreSQL in Docker Compose and
a client that writes offline, then syncs. See the
[quick start](https://accord.benhattab.pro/docs/quickstart/).

## Packages

| Package                                                                        | What it does                                                                                  | Docs                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`@accordsync/client`](https://www.npmjs.com/package/@accordsync/client)       | The device side: local-first writes, background sync, conflicts, IndexedDB and SQLite storage | [Client](https://accord.benhattab.pro/docs/client/)                 |
| [`@accordsync/server`](https://www.npmjs.com/package/@accordsync/server)       | The self-hosted sync server on PostgreSQL: scope rules, JWT auth, `accord serve`              | [Server](https://accord.benhattab.pro/docs/server/)                 |
| [`@accordsync/react`](https://www.npmjs.com/package/@accordsync/react)         | React hooks: `useRecord`, `useConflicts`, `useSyncStatus`                                     | [React](https://accord.benhattab.pro/docs/react/)                   |
| [`@accordsync/core`](https://www.npmjs.com/package/@accordsync/core)           | The merge core: hybrid logical clocks, operations, `lww`, `counter`, `set` and `conflict`     | [Schema and merge rules](https://accord.benhattab.pro/docs/schema/) |
| [`@accordsync/simulator`](https://www.npmjs.com/package/@accordsync/simulator) | A deterministic network and device simulator, to test sync under faults                       | [Proof](https://accord.benhattab.pro/#proof)                        |
| [`create-accord`](https://www.npmjs.com/package/create-accord)                 | Project scaffolder: `npm create accord my-app`                                                | [Quick start](https://accord.benhattab.pro/docs/quickstart/)        |

On React Native, see [React Native](https://accord.benhattab.pro/docs/react-native/).

## Licence

Apache-2.0.

---

This repository builds the website. To run it locally: `npm ci && npm run dev`.
