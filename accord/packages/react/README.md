# @accordsync/react

React hooks for [Accord](https://github.com/crossben/accordsync): records, conflicts and sync status
that re-render when local state changes, whether from a local write or from sync.

```sh
safe-install add @accordsync/react @accordsync/client
```

or `npm install @accordsync/react @accordsync/client`. [safe-install](https://safe-install.benhattab.pro) installs with every
install script off and asks before running any.

```tsx
import { AccordProvider, useConflicts, useRecord, useSyncStatus } from '@accordsync/react';

<AccordProvider client={accord}>
  <App />
</AccordProvider>;

function Dossier({ id }: { id: string }) {
  const d = useRecord(id); // { client_name, visits, documents, status } or undefined
  const { pending, lastError } = useSyncStatus();
  const conflicts = useConflicts(); // conflict() fields waiting for a decision
  // …
}
```

| Hook                | Returns                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `useAccord()`       | the `AccordClient`, to write (`assign`, `inc`, `add`, `remove`, `resolve`) |
| `useRecord(id)`     | the record's fields, or `undefined`                                        |
| `useRecords(type?)` | ids of the records this device holds                                       |
| `useConflicts()`    | every conflicted field with all its values                                 |
| `useSyncStatus()`   | `{ pending, cursor, lastSyncAt, lastError }`                               |

A component re-renders only when what it reads changed. Licence: Apache-2.0.

## Prompt for an AI coding agent

Copy this into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app.

```text
Integrate Accord (@accordsync/react 0.3.x) into this React app.
Install: safe-install add @accordsync/react@^0.3.0 @accordsync/client@^0.3.0
Install with safe-install (https://safe-install.benhattab.pro/llms.txt), never npm/pnpm/yarn
directly. Never approve install scripts yourself (no safe-install approve, --force, --yes or
allowScripts edits): if a script is skipped, stop and tell me the package and its scripts.
Create:
1. src/schema.ts exporting the same defineSchema(...) as the Accord server (share the file or
   keep it identical). Import defineSchema, lww, counter, set, conflict from '@accordsync/client'.
2. Open one client at startup: AccordClient.open({ schema, storage: new IndexedDbStorage('<app>'),
   transport: httpTransport({ url: <sync URL>, getToken }) }); getToken returns the current JWT.
   Call accord.start(); accord.stop() on logout.
3. Wrap the app in AccordProvider, passing the client as its client prop.
In components: useRecord(id) to read, useAccord() to write (assign, inc, add, remove, resolve),
useRecords(type) for lists, useSyncStatus() for pending writes and lastError.
Pick a merge rule for every field, deliberately:
- lww(): the latest write wins. Names, notes, simple scalars.
- counter(): every increment is summed, none is lost. Quantities, stock adjustments.
- set(): add-wins set of elements. Tags, assigned people, attached documents.
- conflict(): concurrent values are all kept and flagged; a person decides. Use it for
  status, approvals, amounts and anything with money or legal weight. Never lww() there.
UI:
- accord.on("refused", (r) => ...): the write was already rolled back; tell the user (r.reason).
- useConflicts(): show every value of a conflicted field where someone can choose, then
  accord.resolve(record, field, value).
Do not:
- set deviceId: the client generates and stores one; a fixed id can get writes refused.
- check the network before writing: writes are local and sync catches up.
- edit or replay ops, or write to the accord_ tables yourself.
- copy records into React state or a store: read them with the hooks.
Verify: open the app in two browser profiles, write in both while one is offline (DevTools),
reconnect, and check both show the same data and the conflict.
Docs: https://accord.benhattab.pro/docs/react/ https://accord.benhattab.pro/docs/client/
```
