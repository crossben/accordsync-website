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

Inside the project, install and run with [safe-install](https://safe-install.benhattab.pro):

```sh
cd my-app
safe-install install
docker compose up -d
cp .env.example .env
safe-install run server
safe-install run client        # in another terminal
```

**Why safe-install.** Installing a package can run its install scripts. safe-install installs with
every lifecycle script off and asks before running any. With npm instead: `npm install`,
`npm run server`, `npm run client`. To add Accord to an existing app:
`safe-install add @accordsync/client` (or `npm install @accordsync/client`).

For language models: [llms.txt](https://accord.benhattab.pro/llms.txt) and
[llms-full.txt](https://accord.benhattab.pro/llms-full.txt).

## Packages

| Package                                                                         | What it does                                                                                  | Docs                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`@accordsync/client`](https://www.npmjs.com/package/@accordsync/client)        | The device side: local-first writes, background sync, conflicts, IndexedDB and SQLite storage | [Client](https://accord.benhattab.pro/docs/client/)                 |
| [`@accordsync/server`](https://www.npmjs.com/package/@accordsync/server)        | The self-hosted sync server on PostgreSQL: scope rules, JWT auth, `accord serve`              | [Server](https://accord.benhattab.pro/docs/server/)                 |
| [`@accordsync/react`](https://www.npmjs.com/package/@accordsync/react)          | React hooks: `useRecord`, `useConflicts`, `useSyncStatus`                                     | [React](https://accord.benhattab.pro/docs/react/)                   |
| [`@accordsync/core`](https://www.npmjs.com/package/@accordsync/core)            | The merge core: hybrid logical clocks, operations, `lww`, `counter`, `set` and `conflict`     | [Schema and merge rules](https://accord.benhattab.pro/docs/schema/) |
| [`@accordsync/simulator`](https://www.npmjs.com/package/@accordsync/simulator)  | A deterministic network and device simulator, to test sync under faults                       | [Proof](https://accord.benhattab.pro/#proof)                        |
| [`create-accord`](https://www.npmjs.com/package/create-accord)                  | Project scaffolder: `npm create accord my-app`                                                | [Quick start](https://accord.benhattab.pro/docs/quickstart/)        |
| [`accordsync_flutter`](https://pub.dev/packages/accordsync_flutter) (Dart)      | Flutter: drift storage on the device, widgets, sync that follows the app lifecycle            | [Flutter](https://accord.benhattab.pro/docs/flutter/)               |
| [`accordsync`](https://pub.dev/packages/accordsync) (Dart)                      | The Dart client, pure Dart: also for command-line tools and servers                           | [Flutter](https://accord.benhattab.pro/docs/flutter/)               |
| [`accordsync_core`](https://pub.dev/packages/accordsync_core) (Dart)            | The Dart merge core                                                                           | [Flutter](https://accord.benhattab.pro/docs/flutter/)               |
| [`accordsync/laravel`](https://packagist.org/packages/accordsync/laravel) (PHP) | The sync server in a Laravel app: provider, config, routes, artisan commands                  | [PHP](https://accord.benhattab.pro/docs/php/)                       |
| [`accordsync/symfony`](https://packagist.org/packages/accordsync/symfony) (PHP) | The sync server in a Symfony app: bundle, configuration, routes, console commands             | [PHP](https://accord.benhattab.pro/docs/php/)                       |
| [`accordsync/server`](https://packagist.org/packages/accordsync/server) (PHP)   | The PHP sync server on PostgreSQL, framework-agnostic (PSR-15)                                | [PHP](https://accord.benhattab.pro/docs/php/)                       |
| [`accordsync/core`](https://packagist.org/packages/accordsync/core) (PHP)       | The PHP merge core                                                                            | [PHP](https://accord.benhattab.pro/docs/php/)                       |
| [`accordsync`](https://pypi.org/project/accordsync/) (Python)                   | The Python client: local-first writes, background sync, conflicts, SQLite storage             | [Python](https://accord.benhattab.pro/docs/python/)                 |
| [`accordsync-fastapi`](https://pypi.org/project/accordsync-fastapi/) (Python)   | The sync server for FastAPI: router and CLI                                                   | [Python](https://accord.benhattab.pro/docs/python/)                 |
| [`accordsync-django`](https://pypi.org/project/accordsync-django/) (Python)     | The sync server for Django: app, URLs, management commands                                    | [Python](https://accord.benhattab.pro/docs/python/)                 |
| [`accordsync-server`](https://pypi.org/project/accordsync-server/) (Python)     | The Python sync server on PostgreSQL, framework-agnostic (and WSGI)                           | [Python](https://accord.benhattab.pro/docs/python/)                 |
| [`accordsync-core`](https://pypi.org/project/accordsync-core/) (Python)         | The Python merge core                                                                         | [Python](https://accord.benhattab.pro/docs/python/)                 |

On React Native, see [React Native](https://accord.benhattab.pro/docs/react-native/). The PHP and
Python servers use the same protocol, merge rules and PostgreSQL schema as `@accordsync/server`.

## Licence

Apache-2.0.

---

This repository builds the website. To run it locally: `npm ci && npm run dev`.
