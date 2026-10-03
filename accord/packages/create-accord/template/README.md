# __NAME__

An [Accord](https://github.com/crossben/accordsync) project: offline-first sync with declared merge
rules.

```sh
npm install
docker compose up -d            # PostgreSQL on port 55432
cp .env.example .env
npm run server                  # Accord on http://localhost:8080
npm run client                  # a device writes offline, then syncs
```

| File               | What                                                  |
| ------------------ | ----------------------------------------------------- |
| `schema.ts`        | Records and merge rules, shared by server and clients |
| `accord.config.ts` | Server: scopes (who reads and writes what) and auth   |
| `client.ts`        | A device writing offline and syncing                  |
| `dev-token.mjs`    | Development tokens (`npm run token -- <user>`)        |

Docs: [client](https://github.com/crossben/accordsync/blob/main/docs/client.md) ·
[scope patterns](https://github.com/crossben/accordsync/blob/main/docs/scopes.md) ·
[React Native](https://github.com/crossben/accordsync/blob/main/docs/react-native.md) ·
[security checklist](https://github.com/crossben/accordsync/blob/main/docs/security.md).
