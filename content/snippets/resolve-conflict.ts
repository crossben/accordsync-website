// Resolve a conflict: status is conflict(), so Accord keeps both values and
// flags the record. It never guesses on money or legal status — the app decides.
import {
  AccordClient,
  httpTransport,
  IndexedDbStorage,
  type ConflictInfo,
} from "@accordsync/client";
import { schema } from "./schema";

// Your app's own logic: surface both values to a human.
declare function askTheUser(c: ConflictInfo): Promise<string>;

const accord = await AccordClient.open({
  schema,
  storage: new IndexedDbStorage("my-field-app"),
  transport: httpTransport({
    url: "https://sync.example.com",
    getToken: () => localStorage.getItem("token") ?? "",
  }),
});

for (const c of accord.conflicts()) {
  // c.values holds every concurrent value, with the op that wrote it.
  const choice = await askTheUser(c); // a business decision — a human, really
  await accord.resolve(c.record, c.field, choice);
}
