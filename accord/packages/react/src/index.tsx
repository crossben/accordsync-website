import type { AccordClient, ConflictInfo, FieldRead } from '@accordsync/client';
import { createContext, type ReactNode, useContext, useSyncExternalStore } from 'react';

const Context = createContext<AccordClient | null>(null);

/** Makes an opened `AccordClient` available to the hooks below. */
export function AccordProvider({
  client,
  children,
}: {
  client: AccordClient;
  children: ReactNode;
}) {
  return <Context.Provider value={client}>{children}</Context.Provider>;
}

/** The client from the nearest `AccordProvider`. */
export function useAccord(): AccordClient {
  const client = useContext(Context);
  if (!client) throw new Error('useAccord: wrap your app in <AccordProvider client={…}>');
  return client;
}

type Status = ReturnType<AccordClient['status']>;

/**
 * Cached reads per client. React needs the same value back until something changed, while the client
 * builds a fresh object on every read; `change`, `synced`, `error` and `resync` events clear exactly
 * what they affect.
 */
class Store {
  readonly #records = new Map<string, Record<string, FieldRead> | undefined>();
  #lists = new Map<string, string[]>();
  #conflicts: ConflictInfo[] | undefined;
  #status: Status | undefined;
  readonly #listeners = new Set<() => void>();

  constructor(private readonly client: AccordClient) {
    client.on('change', ({ records }) => {
      for (const r of records) this.#records.delete(r);
      this.#lists = new Map();
      this.#conflicts = undefined;
      this.#status = undefined;
      this.#notify();
    });
    const statusChanged = () => {
      this.#status = undefined;
      this.#notify();
    };
    client.on('synced', statusChanged);
    client.on('error', statusChanged);
    client.on('resync', () => {
      this.#records.clear();
      statusChanged();
    });
  }

  subscribe = (fn: () => void) => {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  };

  record(id: string) {
    if (!this.#records.has(id)) this.#records.set(id, this.client.read(id));
    return this.#records.get(id);
  }

  records(type: string | undefined) {
    const key = type ?? '';
    let list = this.#lists.get(key);
    if (!list) this.#lists.set(key, (list = this.client.records(type)));
    return list;
  }

  conflicts() {
    return (this.#conflicts ??= this.client.conflicts());
  }

  status() {
    return (this.#status ??= this.client.status());
  }

  #notify() {
    for (const fn of this.#listeners) fn();
  }
}

const stores = new WeakMap<AccordClient, Store>();
function useStore(): Store {
  const client = useAccord();
  let store = stores.get(client);
  if (!store) stores.set(client, (store = new Store(client)));
  return store;
}

/** A record's fields, kept current as local writes and synced changes arrive. `undefined` if unknown. */
export function useRecord(id: string): Record<string, FieldRead> | undefined {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.record(id),
    () => store.record(id),
  );
}

/** The ids of every record this device holds, optionally of one type (`'dossier'`). */
export function useRecords(type?: string): string[] {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.records(type),
    () => store.records(type),
  );
}

/** Every `conflict()` field holding more than one value: show them, then call `client.resolve`. */
export function useConflicts(): ConflictInfo[] {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.conflicts(),
    () => store.conflicts(),
  );
}

/** Pending local changes, last sync time and last error, for an "offline / syncing" indicator. */
export function useSyncStatus(): Status {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.status(),
    () => store.status(),
  );
}
