// The facts sheet — the ONLY source for every claim the website makes
// (website.md section 0 and section 4). Each entry carries its tier and its source; scripts/
// check-facts.mjs re-reads those sources on every build and fails when a claim
// is no longer backed. Never retype a fact in copy: import it from here.
//
// Tiers (website.md section 4):
//   - "designed": stated in plan.md or an ADR in app/docs/adr/. Copy must write
//     it as intent ("Accord is designed to…", "v0.1 will…") and the section
//     shows a Planned badge.
//   - "built": backed by code AND a passing test in app/. Only then may copy
//     use the present tense. Moving a fact up requires a PR that cites the file
//     and the test that prove it.

export const npmName = "accordsync";

/** A fact is "designed" (intent, Planned badge) or "built" (code and a passing test). */
export type Tier = "designed" | "built";

const REPO_BASE = "https://github.com/crossben/accordsync";
const BLOB = `${REPO_BASE}/blob/main`;

/** Repository links. Source: plan.md section 0 (`crossben/accordsync`). */
export const repo = {
  home: REPO_BASE,
  blob: BLOB,
  /** The ADR index: design decisions and their reasons. */
  planProof: `${BLOB}/docs/adr`,
  mergeRules: `${BLOB}/docs/merge-rules.md`,
  changelog: `${BLOB}/CHANGELOG.md`,
  license: `${BLOB}/LICENSE`,
  contributing: `${BLOB}/CONTRIBUTING.md`,
  security: `${BLOB}/SECURITY.md`,
  adr: (n: string) => `${BLOB}/docs/adr/${n}`,
} as const;

/**
 * Version. Source: app/CHANGELOG.md ("## [0.1.0] - 2026-10-02") and app/README.md's status note
 * ("v0.1.0, first release"). check-facts.mjs fails the build if either changes.
 */
export const version = { number: "0.1.0", date: "2026-10-02" } as const;

/**
 * Licence. Source: app/README.md ("## Licence" → "[Apache-2.0](LICENSE)") and
 * app/LICENSE, both present since M0 — so this fact moved designed → built on
 * 2026-10-02, citing those files (website.md section 4). The owner still holds the
 * formal section 11 confirmation decision; nothing to change on the site unless the
 * licence itself changes.
 */
export const licence = {
  accord: "Apache-2.0",
  confirmed: true,
} as const;

/**
 * Merge strategies available in v1 (website.md section 4 / plan.md section 5.3). Ordered
 * lists (`list_ref`) are planned AFTER v1 and must never appear as a row here.
 * All rows are `designed`: the tier flips to `built` per strategy when its
 * strategy-law tests pass in app/ (and features.mergeRulesFromAppDocs turns on
 * once app/docs/merge-rules.md exists).
 *
 * The example numbers below are illustrative fixtures for the table (and for
 * the "3 + 2 = 5" counter row the plan mandates in section 6), not performance claims.
 */
export const strategies = [
  { id: "lww", tier: "built" as Tier },
  { id: "counter", tier: "built" as Tier },
  { id: "set", tier: "built" as Tier },
  { id: "conflict", tier: "built" as Tier },
] as const;

export type StrategyId = (typeof strategies)[number]["id"];

/**
 * Guarantees (website.md section 5.5). All built on 2026-10-02: each cites the test in app/ that
 * proves it, and check-facts.mjs asserts that test still contains the cited case.
 */
const TEST = (path: string) => `${BLOB}/${path}`;
export const guarantees = [
  {
    key: "convergence",
    tier: "built" as Tier,
    source: TEST("packages/simulator/src/convergence.test.ts"),
  },
  {
    key: "counters",
    tier: "built" as Tier,
    source: TEST("packages/simulator/src/convergence.test.ts"),
  },
  { key: "conflicts", tier: "built" as Tier, source: TEST("packages/core/src/laws.test.ts") },
  { key: "idempotent", tier: "built" as Tier, source: TEST("packages/server/test/sync.test.ts") },
  { key: "resumable", tier: "built" as Tier, source: TEST("packages/server/test/sync.test.ts") },
  { key: "scopes", tier: "built" as Tier, source: TEST("packages/server/test/sync.test.ts") },
] as const;

export type GuaranteeKey = (typeof guarantees)[number]["key"];

/** What Accord is not (website.md section 4, plan.md section 1). Straight copy, no jokes. */
export const notKeys = ["database", "collab", "business"] as const;

/**
 * Proof section (website.md section 5.8). Built: the suites exist and run in CI.
 * Case counts: app/.github/workflows/ci.yml (ACCORD_SIM_RUNS, ACCORD_PROPERTY_RUNS).
 */
export const proofs = ["convergenceTest", "strategyLaws", "simulator"] as const;
export const proofSources = {
  convergenceTest: TEST("packages/simulator/src/convergence.test.ts"),
  strategyLaws: TEST("packages/core/src/laws.test.ts"),
  simulator: TEST("packages/simulator/src/simulation.ts"),
} as const;
export const ciRuns = { simulations: 3000, propertyCases: 2000 } as const;

/**
 * Load test (website.md section 4): app/load/README.md, measured 2026-10-02. Always shown with
 * its hardware line and caveat.
 */
export const loadTest = {
  source: `${BLOB}/load/README.md`,
  hardware: "Intel Core i7-11800H laptop, 31 GiB RAM, PostgreSQL 16 defaults, one server process",
  rows: [
    { devices: 50, opsPerSec: 1004, pushP95: 548, pullP95: 14 },
    { devices: 100, opsPerSec: 1033, pushP95: 1049, pullP95: 15 },
    { devices: 200, opsPerSec: 984, pushP95: 2258, pullP95: 20 },
  ],
} as const;

/** Real screenshot of app/examples/field-app (app/docs/screens/), copied to public/screens/. */
export const screenshot = {
  src: "/screens/field-app-conflict.webp",
  width: 1040,
  height: 815,
  example: `${REPO_BASE}/tree/main/examples/field-app`,
} as const;

/** Clients (website.md section 4 / plan.md section 2). Dart/Flutter only as a roadmap line. */
export const clients = {
  v1: "TypeScript (browser + React Native)",
  planned: "Dart/Flutter client after v1",
} as const;
