# __NAME__

An [Accord](https://github.com/crossben/accordsync) project: offline-first sync with declared merge
rules.

```sh
safe-install install
docker compose up -d            # PostgreSQL on port 55432
cp .env.example .env
safe-install run server         # Accord on http://localhost:8080
safe-install run client         # a device writes offline, then syncs
```

[safe-install](https://safe-install.benhattab.pro) installs packages with every install script off
and asks before running any. With npm instead: `npm install`, then `npm run server` and
`npm run client`.

| File               | What                                                  |
| ------------------ | ----------------------------------------------------- |
| `schema.ts`        | Records and merge rules, shared by server and clients |
| `accord.config.ts` | Server: scopes (who reads and writes what) and auth   |
| `client.ts`        | A device writing offline and syncing                  |
| `dev-token.mjs`    | Development tokens (`safe-install run token -- <user>`) |

Docs: [client](https://github.com/crossben/accordsync/blob/main/docs/client.md) ·
[scope patterns](https://github.com/crossben/accordsync/blob/main/docs/scopes.md) ·
[React Native](https://github.com/crossben/accordsync/blob/main/docs/react-native.md) ·
[security checklist](https://github.com/crossben/accordsync/blob/main/docs/security.md).
