# Contributing to Accord

Thank you for helping. Issues and pull requests are welcome.

## Before you start

- **Bugs:** open an issue with what you did, what you expected, and what happened. A failing seed
  from the convergence suite (`ACCORD_SIM_SEED=…`) is the best bug report there is.
- **Security issues:** never in public issues. See [SECURITY.md](SECURITY.md).
- **Bigger changes** (a new merge strategy, a protocol change): open an issue first. Decisions are
  recorded as ADRs in [`docs/adr/`](docs/adr/), and a change of decision gets a new ADR.

## Develop

Node 22.12+ (24 recommended), pnpm 11 (`corepack enable`), and Docker for the server tests.

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm build
pnpm test                  # starts PostgreSQL 16 with Testcontainers
```

## Rules the code follows

- **Tests first for the merge core.** `packages/core` stays pure: no I/O, no clock reads, no
  randomness (a lint rule enforces it). Every behaviour change there comes with a property test.
- **The convergence suite must stay green.** CI runs thousands of generated cases; a failure prints
  a seed that replays exactly.
- **Golden vectors are never edited.** Add new cases in `vectors/` instead.
- **Public claims match the repository.** Numbers in docs come from runs in this repository, with
  the hardware stated.

## Licence

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE), the licence of this project.
