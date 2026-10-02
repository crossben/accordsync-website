# ADR-0001: Why Accord

- Status: accepted
- Date: 2026-10-02

## Context

Field apps in West Africa (enrolment, waste collection, shops, mobile clients) run where the
network drops for minutes or days. The owner has solved offline sync by hand several times, each
time partially: last write wins (silently losing edits) or "please reconnect".

## Decision

Build one open-source, self-hosted sync engine, published as a public library from day one:

- local-first writes; the network is never on the critical path;
- changes recorded as operations in an append-only log, ordered by hybrid logical clocks;
- per-field merge strategies declared in the app's schema, with `conflict()` for fields where
  guessing is unacceptable;
- correctness shown by property-based convergence tests under simulated network faults.

The project is named **Accord** (npm `accordsync`, GitHub `crossben/accordsync`). The working
name "Relay" was dropped because Meta's GraphQL client already owns it in JavaScript.

## Consequences

- Outside developers are the audience: public APIs follow semver, docs and self-hosting must be
  easy.
- Scope stays small: one server, PostgreSQL, single region, TypeScript client. A small v1 that is
  provably correct beats a big one that mostly works.
