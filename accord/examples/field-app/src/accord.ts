import { AccordClient, httpTransport, IndexedDbStorage, type Transport } from '@accordsync/client';
import { schema } from '../../server/schema.ts';
import { type AgentId, devToken } from './agents';

/** Lets the demo cut the network for one tab, the way a field agent loses signal. */
export const network = { offline: sessionStorage.getItem('accord-offline') === '1' };

export async function openAccord(agent: AgentId): Promise<AccordClient> {
  const http = httpTransport({ url: location.origin, getToken: () => devToken(agent) });
  const transport: Transport = {
    push: (device, ops) => (network.offline ? offline() : http.push(device, ops)),
    pull: (device, cursor, limit) =>
      network.offline ? offline() : http.pull(device, cursor, limit),
  };
  const client = await AccordClient.open({
    schema,
    // One local database per agent: open each agent in its own tab.
    storage: new IndexedDbStorage(`accord-field-${agent}`),
    // Readable device ids ("moussa-3f2a1c"), so the conflict UI can say who wrote what.
    deviceId: `${agent}-${crypto.randomUUID().slice(0, 6)}`,
    transport,
    syncIntervalMs: 3_000,
    minBackoffMs: 1_000,
    maxBackoffMs: 5_000,
  });
  client.start();
  return client;
}

function offline(): never {
  throw new TypeError('offline (simulated in this tab)');
}
