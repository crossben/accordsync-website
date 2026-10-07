# Using the client

`@accordsync/client` keeps a full working copy of the user's records on the device. Writes apply
at once, with no network; sync runs in the background.

```ts
import { AccordClient, IndexedDbStorage, httpTransport } from '@accordsync/client';
import { schema } from './schema'; // the same defineSchema(...) the server uses

const accord = await AccordClient.open({
  schema,
  storage: new IndexedDbStorage('my-app'),
  transport: httpTransport({ url: 'https://sync.example.com', getToken: () => auth.token() }),
});
accord.start(); // background sync: after writes, every 30 s, with backoff when offline

await accord.assign('dossier:91', 'client_name', 'Aminata Fall');
await accord.inc('dossier:91', 'visits', 1);
await accord.add('dossier:91', 'documents', 'cni.pdf');
accord.read('dossier:91'); // { client_name: 'Aminata Fall', visits: 1, documents: ['cni.pdf'], … }
```

Each write resolves once it is saved on the device. It is visible to `read` immediately.

## Conflicts

`conflict()` fields are never decided for you.

```ts
for (const c of accord.conflicts()) {
  // { record: 'dossier:91', field: 'status', values: [{ value: 'approved', opId }, { value: 'rejected', opId }] }
  const choice = await askTheUser(c);
  await accord.resolve(c.record, c.field, choice);
}
```

A resolution replaces the values the device was showing. A value written elsewhere that this device
had not seen yet stays, and the field remains conflicted until it is resolved too.

## Events

| Event     | When                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `change`  | Local state changed: a write, received ops, a rollback, or a record leaving scope. Re-render these records. |
| `refused` | The server refused a local write. It has already been rolled back. `{ opId, record, field, reason }`        |
| `synced`  | A sync round finished.                                                                                      |
| `resync`  | The user's read scopes changed; local data was reloaded. Unsynced edits were kept.                          |
| `error`   | A sync round failed (offline, server error). Background sync retries with backoff.                          |

```ts
const off = accord.on('refused', (r) => toast(`Not saved: ${r.reason}`));
```

## Storage

| Adapter            | Where                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| `IndexedDbStorage` | Browsers                                                                             |
| `SqliteStorage`    | Any SQLite: wa-sqlite (web), op-sqlite (React Native), `node:sqlite`, better-sqlite3 |
| `MemoryStorage`    | Tests; unsynced writes are lost on restart                                           |

`SqliteStorage` takes a two-method driver. For op-sqlite:

```ts
import { open } from '@op-engineering/op-sqlite';
const db = open({ name: 'accord.db' });
const storage = new SqliteStorage({
  run: async (sql, params) => void (await db.execute(sql, params as any[])),
  all: async (sql, params) => (await db.execute(sql, params as any[])).rows as any[],
});
```

Its tables are prefixed `accord_`, so it can share the app's database. Each commit is one
transaction.

## What sync does

1. **Push** the outbox in batches. Acknowledged ops leave the outbox; refused ones are rolled back
   and reported.
2. **Pull** every page from the stored cursor, applying ops. An `exit` deletes the record locally
   (except edits not yet pushed, which are pushed, refused and rolled back like any refused write).
3. On `resync_required`, push again, keep only unpushed edits, and pull from zero.

Leave `deviceId` unset unless you have a reason: the client generates a random id and stores it. If
you pass a fixed id and the app's storage is wiped, writes made before the next sync are refused
(reported through `refused`), because their op ids were already used.

The device id, cursor, clock and op counter are stored, so a restarted app continues where it
stopped and never reuses an op id.

## Prompt for an AI coding agent

Copy this into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app.

```text
Integrate Accord (@accordsync/client 0.3.x) into this web app.
Install: safe-install add @accordsync/client@^0.3.0
Install with safe-install (https://safe-install.benhattab.pro/llms.txt), never npm/pnpm/yarn
directly. Never approve install scripts yourself (no safe-install approve, --force, --yes or
allowScripts edits): if a script is skipped, stop and tell me the package and its scripts.
Create:
1. src/schema.ts exporting the same defineSchema(...) as the Accord server (share the file or
   keep it identical). Import defineSchema, lww, counter, set, conflict from '@accordsync/client'.
2. A module that opens one client per app: AccordClient.open({ schema, storage: new
   IndexedDbStorage('<app>'), transport: httpTransport({ url: <sync URL>, getToken }) }).
   getToken returns the user's current JWT; it is called before every request.
3. Call accord.start() after open and accord.stop() on logout/teardown.
Write with accord.assign / inc / add / remove; read with accord.read(id). Re-render on
accord.on('change', ...).
Pick a merge rule for every field, deliberately:
- lww(): the latest write wins. Names, notes, simple scalars.
- counter(): every increment is summed, none is lost. Quantities, stock adjustments.
- set(): add-wins set of elements. Tags, assigned people, attached documents.
- conflict(): concurrent values are all kept and flagged; a person decides. Use it for
  status, approvals, amounts and anything with money or legal weight. Never lww() there.
UI:
- accord.on("refused", (r) => ...): the write was already rolled back; tell the user (r.reason).
- accord.conflicts() lists conflict() fields with all values; show them where someone can
  choose, then accord.resolve(record, field, value).
- Show pending writes / last error from accord.status().
Do not:
- set deviceId: the client generates and stores one; a fixed id can get writes refused.
- check the network before writing: writes are local and sync catches up.
- edit or replay ops, or write to the accord_ tables yourself.
Verify: open the app in two browser profiles as users with the same scope, write in both while
one is offline (DevTools), reconnect, and check both show the same data and the conflict.
Docs: https://accord.benhattab.pro/docs/client/ https://accord.benhattab.pro/docs/schema/
```
