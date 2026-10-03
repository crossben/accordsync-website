// A device: writes offline first, then syncs. Run: npm run client (with the server running).
import { AccordClient, httpTransport, MemoryStorage } from '@accordsync/client';
import { schema } from './schema.ts';
import { devToken } from './dev-token.mjs';

const accord = await AccordClient.open({
  schema,
  storage: new MemoryStorage(), // in an app: IndexedDbStorage or SqliteStorage
  transport: httpTransport({ url: 'http://localhost:8080', getToken: () => devToken('awa') }),
});

const id = 'task:1';
await accord.assign(id, 'owner', 'awa');
await accord.assign(id, 'title', 'Visit the market');
await accord.add(id, 'tags', 'field');
await accord.inc(id, 'time_spent', 15);
console.log('local, before sync:', accord.read(id), `(${accord.status().pending} pending)`);

await accord.sync();
console.log('after sync:', accord.status().pending, 'pending; the server has it.');
