// Write offline: the network is never on the critical path of a user action.
// Writes apply at once on the device, and sync runs in the background.
import { AccordClient, httpTransport, IndexedDbStorage } from "@accordsync/client";
import { schema } from "./schema";

const accord = await AccordClient.open({
  schema,
  storage: new IndexedDbStorage("my-field-app"),
  transport: httpTransport({
    url: "https://sync.example.com",
    getToken: () => localStorage.getItem("token") ?? "",
  }),
});
accord.start(); // background sync: after writes, every 30 s, backoff when offline

// Each write resolves once it is saved on the device, and read() sees it immediately.
await accord.assign("dossier:91", "client_name", "Aminata Fall");
await accord.inc("dossier:91", "visits", 1);
await accord.add("dossier:91", "documents", "cni.pdf");
accord.read("dossier:91");
