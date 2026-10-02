import type { AccordClient, ConflictRead, Refusal } from '@accordsync/client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { openAccord, network } from './accord';
import { AGENTS, type AgentId, currentAgent } from './agents';

const STATUSES = ['draft', 'submitted', 'approved', 'rejected'];

export function App() {
  const agent = currentAgent();
  const [client, setClient] = useState<AccordClient>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let c: AccordClient | undefined;
    openAccord(agent).then(
      (x) => setClient((c = x)),
      (e: unknown) => setError(String(e)),
    );
    return () => void c?.close();
  }, [agent]);

  if (error) return <p className="fatal">Could not open local storage: {error}</p>;
  if (!client) return <p className="loading">Opening local data…</p>;
  return <Workspace client={client} agent={agent} />;
}

/** Re-renders whenever Accord reports a change, a sync or an error. */
function useAccordVersion(client: AccordClient): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const offs = [
      client.on('change', bump),
      client.on('synced', bump),
      client.on('error', bump),
      client.on('resync', bump),
    ];
    return () => offs.forEach((off) => off());
  }, [client]);
  return version;
}

function Workspace({ client, agent }: { client: AccordClient; agent: AgentId }) {
  useAccordVersion(client);
  const [selected, setSelected] = useState<string>();
  const [toasts, setToasts] = useState<Refusal[]>([]);
  const offline = useSyncExternalStore(subscribeOffline, () => network.offline);

  useEffect(
    () =>
      client.on('refused', (r) => {
        setToasts((t) => [...t, r]);
        setTimeout(() => setToasts((t) => t.slice(1)), 6_000);
      }),
    [client],
  );

  const dossiers = client.records('dossier');
  const conflicted = new Set(client.conflicts().map((c) => c.record));
  const status = client.status();
  const me = AGENTS[agent];

  const create = async () => {
    const id = `dossier:${crypto.randomUUID().slice(0, 8)}`;
    await client.assign(id, 'agent', agent);
    await client.assign(id, 'zone', me.zones[0]);
    await client.assign(id, 'status', 'draft');
    setSelected(id);
  };

  return (
    <div className="app">
      <header>
        <div>
          <strong>Accord field app</strong> · {me.name}{' '}
          <span className="muted">(zone {me.zones.join(', ')})</span>
        </div>
        <nav className="muted">
          Open another agent in a new tab:{' '}
          {(Object.keys(AGENTS) as AgentId[])
            .filter((a) => a !== agent)
            .map((a) => (
              <a key={a} href={`?agent=${a}`} target="_blank" rel="noreferrer">
                {AGENTS[a].name}
              </a>
            ))}
        </nav>
        <div className="sync">
          <button className={offline ? 'off' : 'on'} onClick={() => setOffline(client, !offline)}>
            {offline ? '✈ Offline' : '● Online'}
          </button>
          <span title="Local changes not yet acknowledged by the server">
            {status.pending} pending
          </span>
          <span className="muted">
            {status.lastError
              ? `sync failed: ${String((status.lastError as Error).message ?? status.lastError)}`
              : status.lastSyncAt
                ? `synced ${new Date(status.lastSyncAt).toLocaleTimeString()}`
                : 'not synced yet'}
          </span>
          <button disabled={offline} onClick={() => void client.sync().catch(() => undefined)}>
            Sync now
          </button>
        </div>
      </header>

      <main>
        <aside>
          <button onClick={() => void create()}>+ New dossier</button>
          <ul>
            {dossiers.map((id) => (
              <li key={id}>
                <button
                  className={id === selected ? 'selected' : ''}
                  onClick={() => setSelected(id)}
                >
                  {String(client.read(id)?.client_name ?? 'Unnamed')}{' '}
                  <span className="muted">{id.slice(8)}</span>
                  {conflicted.has(id) && (
                    <span className="flag" aria-label="conflict">
                      ⚠
                    </span>
                  )}
                </button>
              </li>
            ))}
            {dossiers.length === 0 && <li className="muted">No dossiers yet.</li>}
          </ul>
        </aside>
        {selected && client.read(selected) ? (
          <Dossier key={selected} client={client} id={selected} />
        ) : (
          <section className="empty muted">
            Pick or create a dossier. Then go offline in two tabs and edit it in both.
          </section>
        )}
      </main>

      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.opId} className="toast">
            Not saved: {t.field} on {t.record}. {t.reason}
          </div>
        ))}
      </div>
    </div>
  );
}

function Dossier({ client, id }: { client: AccordClient; id: string }) {
  const d = client.read(id)!;
  const status = d.status as ConflictRead | undefined;
  const [name, setName] = useState(String(d.client_name ?? ''));
  const [doc, setDoc] = useState('');
  useEffect(() => setName(String(d.client_name ?? '')), [d.client_name]);

  return (
    <section className="dossier">
      <h2>
        Dossier <code>{id.slice(8)}</code>
      </h2>
      <p className="muted">
        Agent {String(d.agent)} · zone {String(d.zone)}
      </p>

      <label>
        Client name <small className="muted">lww: the latest edit wins</small>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== d.client_name && void client.assign(id, 'client_name', name)}
        />
      </label>

      <div className="row">
        <span>
          Visits: <strong>{String(d.visits)}</strong>{' '}
          <small className="muted">counter: every visit counts</small>
        </span>
        <button onClick={() => void client.inc(id, 'visits', 1)}>+1 visit</button>
      </div>

      <div>
        Documents <small className="muted">set: an add wins over a concurrent remove</small>
        <ul className="docs">
          {(d.documents as string[]).map((x) => (
            <li key={x}>
              {x} <button onClick={() => void client.remove(id, 'documents', x)}>remove</button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (doc) void client.add(id, 'documents', doc).then(() => setDoc(''));
          }}
        >
          <input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="e.g. cni.pdf" />
          <button>Add</button>
        </form>
      </div>

      <div>
        Status <small className="muted">conflict(): never decided for you</small>
        {status && 'conflicted' in status ? (
          <div className="conflict" role="alert">
            <p>
              <strong>Agents disagree.</strong> Accord kept every value. Which one is right?
            </p>
            {status.conflicted.map((v) => (
              <button key={v.opId} onClick={() => void client.resolve(id, 'status', v.value)}>
                Keep “{String(v.value)}”{' '}
                <small className="muted">from {v.opId.split(':')[0]}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="row">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={status?.value === s ? 'selected' : ''}
                onClick={() => void client.assign(id, 'status', s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="row">
        Reassign to
        {(Object.keys(AGENTS) as AgentId[]).map((a) => (
          <button
            key={a}
            disabled={d.agent === a}
            onClick={() => void client.assign(id, 'agent', a)}
          >
            {AGENTS[a].name}
          </button>
        ))}
      </div>
    </section>
  );
}

const offlineListeners = new Set<() => void>();
function subscribeOffline(fn: () => void) {
  offlineListeners.add(fn);
  return () => offlineListeners.delete(fn);
}
function setOffline(client: AccordClient, value: boolean) {
  network.offline = value;
  sessionStorage.setItem('accord-offline', value ? '1' : '0');
  offlineListeners.forEach((fn) => fn());
  if (!value) void client.sync().catch(() => undefined);
}
