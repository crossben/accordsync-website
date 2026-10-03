# React Native

Field apps usually run on phones. This page sets up `@accordsync/client` in a React Native (or Expo)
app, with on-device SQLite, background-friendly sync, and the React hooks.

## Install

```sh
npm install @accordsync/client @accordsync/react @op-engineering/op-sqlite react-native-get-random-values
# Expo: npx expo install … and use a development build (op-sqlite is a native module)
```

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
