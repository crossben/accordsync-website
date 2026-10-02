// content/snippets/resolve-conflict.ts — the "Resolve a conflict" tab
// (website.md §5.6). See schema.ts for the API-preview note.
import type { Conflict } from "@accordsync/core";

// status is conflict(): Accord keeps both values and flags the record.
// It never guesses on money or legal status — the app decides.
client.onConflict<Conflict<"status">>("dossier:91", "status", (c) => {
  // c.values holds every concurrent value, with the device and HLC that wrote it.
  showResolutionDialog(c.values);
});
