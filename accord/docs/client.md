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

The device id, cursor, clock and op counter are stored, so a restarted app continues where it
stopped and never reuses an op id.
