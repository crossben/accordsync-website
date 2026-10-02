// The facts sheet — the ONLY source for every claim the website makes
// (website.md §0 and §4). Each entry carries its tier and its source; scripts/
// check-facts.mjs re-reads those sources on every build and fails when a claim
// is no longer backed. Never retype a fact in copy: import it from here.
//
// Tiers (website.md §4):
//   - "designed": stated in plan.md or an ADR in app/docs/adr/. Copy must write
//     it as intent ("Accord is designed to…", "v0.1 will…") and the section
//     shows a Planned badge.
//   - "built": backed by code AND a passing test in app/. Only then may copy
//     use the present tense. Moving a fact up requires a PR that cites the file
//     and the test that prove it.

export const npmName = "accordsync";

const REPO_BASE = "https://github.com/crossben/accordsync";
const BLOB = `${REPO_BASE}/blob/main`;

/** Repository links. Source: plan.md §0 (`crossben/accordsync`). */
export const repo = {
  home: REPO_BASE,
  blob: BLOB,
  /** plan.md §6 — the proving-it-correct chapter the planned guarantees point at.
   *  plan.md travels with the Accord repository; the root link always resolves. */
  planProof: REPO_BASE,
  mergeRules: `${BLOB}/docs/merge-rules.md`,
  changelog: `${BLOB}/CHANGELOG.md`,
  license: `${BLOB}/LICENSE`,
  contributing: `${BLOB}/CONTRIBUTING.md`,
  security: `${BLOB}/SECURITY.md`,
  adr: (n: string) => `${BLOB}/docs/adr/${n}`,
} as const;

/**
 * Version. Source: app/CHANGELOG.md. No version exists until `v0.1.0` is tagged,
 * so the site shows the required status line instead (website.md §4):
 * "In development: not released yet. Follow along on GitHub."
 * After the tag: version and date. check-facts.mjs fails the build the moment
 * app/CHANGELOG.md gains a v0.1.0 heading, forcing this to be updated.
 */
export const version = null; // null until v0.1.0 — the site is "in development"

/** Licence. Source: plan.md §3 — designed, owner to confirm (website.md §11). */
export const licence = {
  accord: "Apache-2.0",
  confirmed: false,
} as const;

/**
 * Merge strategies available in v1 (website.md §4 / plan.md §5.3). Ordered
 * lists (`list_ref`) are planned AFTER v1 and must never appear as a row here.
 * All rows are `designed`: the tier flips to `built` per strategy when its
 * strategy-law tests pass in app/ (and features.mergeRulesFromAppDocs turns on
 * once app/docs/merge-rules.md exists).
 *
 * The example numbers below are illustrative fixtures for the table (and for
 * the "3 + 2 = 5" counter row the plan mandates in §6), not performance claims.
 */
export const strategies = [
  { id: "lww", tier: "designed" },
  { id: "counter", tier: "designed" },
  { id: "set", tier: "designed" },
  { id: "conflict", tier: "designed" },
] as const;

export type StrategyId = (typeof strategies)[number]["id"];

/**
 * Planned guarantees (website.md §5.5). Every item is `designed` — none is
 * backed by a passing test in app/ yet, so the section renders them as Planned,
 * each pointing at plan.md §6 via repo.planProof. When a fact moves to `built`,
 * add its source link here and the section renders it in the present tense.
 */
export const guarantees = [
  { key: "convergence", tier: "designed", source: null },
  { key: "counters", tier: "designed", source: null },
  { key: "conflicts", tier: "designed", source: null },
  { key: "idempotent", tier: "designed", source: null },
  { key: "resumable", tier: "designed", source: null },
  { key: "scopes", tier: "designed", source: null },
] as const;

export type GuaranteeKey = (typeof guarantees)[number]["key"];

/** What Accord is not (website.md §4, plan.md §1). Straight copy, no jokes. */
export const notKeys = ["database", "collab", "business"] as const;

/**
 * Proof section (website.md §5.8): how correctness is tested, per plan.md §6.
 * All designed until CI produces committed report files in app/.
 */
export const proofs = ["convergenceTest", "strategyLaws", "simulator"] as const;

/** Clients (website.md §4 / plan.md §2). Dart/Flutter only as a roadmap line. */
export const clients = {
  v1: "TypeScript (browser + React Native)",
  planned: "Dart/Flutter client after v1",
} as const;
