// content/snippets/schema.ts — the "Define a schema" tab (website.md §5.6).
// API preview: the @accordsync packages do not exist yet. Once
// app/packages/core and app/packages/client export the API, `npm run
// check:snippets` (CI) type-checks this file against them; until then the site
// must show the "API preview" label (features.snippetsCheckedAgainstApp).
// This file is excluded from the site's tsconfig on purpose.
import { conflict, counter, defineRecord, lww, set } from "@accordsync/core";

export const dossier = defineRecord("dossier", {
  client_name: lww(), // highest HLC wins
  documents: set(), // add-wins set
  visits: counter(), // PN-counter: never loses an increment
  status: conflict(), // never auto-resolved: the app decides
});
