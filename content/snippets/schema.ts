// Define a schema: every field declares its merge strategy, and the strategy
// decides who wins when two devices edited the same field offline. The server
// loads the same schema. Type-checked against @accordsync/core by
// `npm run check:snippets` (CI); excluded from the site's tsconfig on purpose.
import { conflict, counter, defineSchema, lww, set } from "@accordsync/core";

export const schema = defineSchema({
  dossier: {
    client_name: lww(), // highest HLC wins
    documents: set(), // add-wins set
    visits: counter(), // PN-counter: never loses an increment
    status: conflict(), // never auto-resolved: the app decides
  },
});
