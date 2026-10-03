# @accordsync/react

React hooks for [Accord](https://github.com/crossben/accordsync): records, conflicts and sync status
that re-render when local state changes, whether from a local write or from sync.

```sh
npm install @accordsync/react @accordsync/client
```

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
