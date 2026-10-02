# Field app example

Two field agents, one dossier, no network. This small React app shows what Accord does when agents
edit the same records offline.

![Two agents disagreed on the status while offline: Accord kept both values](../../docs/screens/field-app-conflict.png)

## Run it

```sh
# from the repository root
pnpm install
docker compose up -d --build                       # PostgreSQL + the Accord server on :8080
pnpm --filter @accordsync/example-field-app dev    # the app on http://localhost:5173
```

Open <http://localhost:5173/?agent=awa> and, in another tab, <http://localhost:5173/?agent=moussa>.
Both agents work in the Dakar zone.

## Try this

1. As Awa, create a dossier, name the client, add `cni.pdf`.
2. As Moussa, open it (it arrives within a few seconds), press **Online** to go offline, set the
   status to **approved** and add a visit.
3. As Awa, go offline too, set the status to **rejected** and add a visit.
4. Bring both tabs back online.

Both agents now see **3 visits** (no increment is lost) and a conflict on the status: Accord kept
both values and asks which one is right. Pick one in either tab; the other tab follows.

Also try: remove a document in one offline tab while adding it again in the other (the add wins),
reassign a dossier to Fatou (Thiès zone) and watch it stay visible to the Dakar agents through its
zone, or open `?agent=fatou`, who sees only Thiès dossiers.

## What is real and what is a shortcut

- Real: the client library, IndexedDB storage, the sync server, PostgreSQL, scopes, conflicts.
- **Shortcut, demo only:** the app signs its own JWTs with the development secret from
  `docker-compose.yml` (`src/agents.ts`). A real app gets tokens from its own auth server, and the
  browser never holds a signing secret.
- The **Online/Offline** button simulates losing signal for one tab; the real client handles a real
  network loss the same way, with retries and backoff.
