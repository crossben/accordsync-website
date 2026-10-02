// content/snippets/offline-write.ts — the "Write offline" tab (website.md §5.6).
// See schema.ts for the API-preview note.
import { createClient, indexedDbAdapter } from "@accordsync/client";

const client = createClient({
  storage: indexedDbAdapter(),
  server: "https://sync.example.org",
});

// The network is never on the critical path of a user action: the write lands
// in local storage first and becomes an op in the append-only log.
const dossier = client.edit("dossier:91");
dossier.visits.increment(1);
dossier.client_name.set("Awa Ndiaye");

// Sync runs in the background: push in idempotent batches, pull in resumable
// pages. Going offline changes nothing here.
