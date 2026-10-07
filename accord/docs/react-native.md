# React Native

Field apps usually run on phones. This page sets up `@accordsync/client` in a React Native (or Expo)
app, with on-device SQLite, background-friendly sync, and the React hooks.

## Install

```sh
safe-install add @accordsync/client @accordsync/react @op-engineering/op-sqlite react-native-get-random-values
# Expo: npx expo install … and use a development build (op-sqlite is a native module)
```

or `npm install …` with the same packages. [safe-install](https://safe-install.benhattab.pro)
installs with every install script off and asks before running any; op-sqlite is a native module,
so approve its scripts yourself if the build needs them.

Import the random-values polyfill **first**, at the very top of your entry file. The client uses
`crypto.getRandomValues` to create the device id; without it, `AccordClient.open` stops with an error
naming this package rather than inventing a weak id.

```ts
// index.js (or App.tsx), first line
import 'react-native-get-random-values';
```

## Open the client

```ts
import { open as openSqlite } from '@op-engineering/op-sqlite';
import { AccordClient, httpTransport, SqliteStorage } from '@accordsync/client';
import { schema } from './schema'; // the same defineSchema(...) as the server

const db = openSqlite({ name: 'accord.db' });

export async function openAccord(getToken: () => Promise<string>) {
  return AccordClient.open({
    schema,
    storage: new SqliteStorage({
      run: async (sql, params) => {
        await db.execute(sql, params as never[]);
      },
      all: async (sql, params) => (await db.execute(sql, params as never[])).rows as never[],
    }),
    transport: httpTransport({ url: 'https://sync.example.com', getToken }),
  });
}
```

Leave `deviceId` unset: the client generates one and stores it in SQLite. A fixed id that survives a
reinstall while the storage does not makes the first offline writes after the reinstall be refused
(reported through the `refused` event), because their op ids were already used.

Accord's tables are prefixed `accord_`, so they can live in your app's existing database.

## Sync when it makes sense

Sync in the foreground, pause in the background, and sync at once when the network comes back.

```tsx
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AccordClient } from '@accordsync/client';

export function useAccordLifecycle(accord: AccordClient) {
  useEffect(() => {
    accord.start(); // after writes, every 30 s, with backoff while offline
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') accord.start();
      else accord.stop(); // the OS suspends the app anyway; stop timers cleanly
    });
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void accord.sync().catch(() => undefined);
    });
    return () => {
      app.remove();
      net();
      accord.stop();
    };
  }, [accord]);
}
```

Writes never wait for any of this: `await accord.inc(…)` returns as soon as the change is saved in
SQLite, online or not.

For sync while the app is closed, schedule `accord.sync()` with your platform's background task
library (for example `expo-background-fetch` or `react-native-background-fetch`). The OS decides how
often it runs; treat it as a bonus, not a guarantee.

## Use the hooks

```tsx
import {
  AccordProvider,
  useAccord,
  useConflicts,
  useRecord,
  useSyncStatus,
} from '@accordsync/react';

<AccordProvider client={accord}>
  <App />
</AccordProvider>;

function DossierScreen({ id }: { id: string }) {
  const accord = useAccord();
  const dossier = useRecord(id);
  const { pending } = useSyncStatus();
  const conflicts = useConflicts().filter((c) => c.record === id);
  // render, then write with accord.assign / inc / add / remove / resolve
}
```

## Check list

- [ ] `react-native-get-random-values` imported before anything else.
- [ ] The schema file is shared with the server (or kept identical).
- [ ] `getToken` returns a fresh token; Accord calls it before every request.
- [ ] Refusals are shown to the user (`accord.on('refused', …)`): their write was rolled back.
- [ ] Conflicts are shown where the user can decide (`useConflicts`).
- [ ] The device database is protected like the rest of your app's data. Accord does not encrypt
      it; use SQLCipher with op-sqlite if the data is sensitive.

## Prompt for an AI coding agent

Copy this into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app.

```text
Integrate Accord (@accordsync/client 0.3.x) into this React Native app.
Install: safe-install add @accordsync/client@^0.3.0 @accordsync/react@^0.3.0
@op-engineering/op-sqlite react-native-get-random-values (Expo: development build).
Install with safe-install (https://safe-install.benhattab.pro/llms.txt), never npm/pnpm/yarn
directly. Never approve install scripts yourself (no safe-install approve, --force, --yes or
allowScripts edits): if a script is skipped, stop and tell me the package and its scripts.
Create:
1. Import the react-native-get-random-values polyfill on the very first line of the entry file.
2. src/schema.ts with the same defineSchema(...) as the Accord server.
3. openAccord(getToken): AccordClient.open with new SqliteStorage({ run, all }) over op-sqlite
   and httpTransport({ url: <sync URL>, getToken }), exactly as in the docs page.
4. useAccordLifecycle(accord): accord.start() in the foreground, accord.stop() in the background,
   accord.sync() when NetInfo reports a connection.
5. <AccordProvider client={accord}> around the app; read with useRecord, write with useAccord().
Pick a merge rule for every field, deliberately:
- lww(): the latest write wins. Names, notes, simple scalars.
- counter(): every increment is summed, none is lost. Quantities, stock adjustments.
- set(): add-wins set of elements. Tags, assigned people, attached documents.
- conflict(): concurrent values are all kept and flagged; a person decides. Use it for
  status, approvals, amounts and anything with money or legal weight. Never lww() there.
UI:
- accord.on("refused", (r) => ...): the write was already rolled back; tell the user (r.reason).
- useConflicts(): show the values where someone can choose, then accord.resolve(...).
- useSyncStatus() for pending writes and lastError.
Do not:
- set deviceId: the client generates and stores one; a fixed id can get writes refused.
- check the network before writing: writes are local and sync catches up.
- edit or replay ops, or write to the accord_ tables yourself.
Verify: run two devices or simulators, put one in airplane mode, write on both, reconnect, and
check both show the same data and the conflict.
Docs: https://accord.benhattab.pro/docs/react-native/ https://accord.benhattab.pro/docs/react/
```
