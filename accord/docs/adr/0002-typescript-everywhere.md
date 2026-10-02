# ADR-0002: TypeScript everywhere

- Status: accepted
- Date: 2026-10-02

## Context

The first plan proposed a Kotlin/Spring server with a TypeScript client. The merge core (clocks,
operations, strategies) must behave identically on both sides; any difference breaks convergence.

Options considered:

1. **Kotlin server + TypeScript client.** Builds on the owner's Spring experience; the JVM is strong
   under load. But there are two merge cores to write and prove, and a third with Dart.
2. **TypeScript everywhere.** One pure core shared by client and server.
3. **Rust core** compiled to WASM and native. One core for every platform, but React Native's
   Hermes engine has no WASM, so it needs native bindings and heavy tooling for v1.

## Decision

TypeScript everywhere: `packages/core` is imported by both the client and a Node server (Hono,
Kysely, PostgreSQL 16). A pnpm workspace holds the packages; tsdown builds them; Vitest and
fast-check test them.

Pinned to **TypeScript 6.0**, not 7.0: typescript-eslint supports TypeScript below 6.1 only (checked
2026-10-02). Revisit when it supports 7.

## Consequences

- Strategy laws and convergence are proven once, in one language.
- The adopters (web and React Native developers) can read and contribute to every part.
- The future Dart client needs its own port of the core. The golden vectors in `vectors/` are the
  contract that port must pass.
- Node is weaker than the JVM at heavy CPU work. Sync is mostly I/O and small merges; load tests
  (M6) will show whether this matters.
