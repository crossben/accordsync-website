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

const REPO_BASE = "https://github.com/crossben/accordsync";
const BLOB = `${REPO_BASE}/blob/main`;

/** Repository links. Source: plan.md section 0 (`crossben/accordsync`). */
export const repo = {
  home: REPO_BASE,
  blob: BLOB,
  /** plan.md section 6 — the proving-it-correct chapter the planned guarantees point at.
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
 * so the site shows the required status line instead (website.md section 4):
 * "In development: not released yet. Follow along on GitHub." — which app/
 * README.md's own status note backs. After the tag: version and date.
 * check-facts.mjs fails the build the moment app/CHANGELOG.md gains a v0.1.0
 * heading, forcing this to be updated.
 */
export const version = null; // null until v0.1.0 — the site is "in development"

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
  { id: "lww", tier: "designed" },
  { id: "counter", tier: "designed" },
  { id: "set", tier: "designed" },
  { id: "conflict", tier: "designed" },
] as const;

export type StrategyId = (typeof strategies)[number]["id"];

/**
 * Planned guarantees (website.md section 5.5). Every item is `designed` — none is
 * backed by a passing test in app/ yet, so the section renders them as Planned,
 * each pointing at plan.md section 6 via repo.planProof. When a fact moves to `built`,
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

/** What Accord is not (website.md section 4, plan.md section 1). Straight copy, no jokes. */
export const notKeys = ["database", "collab", "business"] as const;

/**
 * Proof section (website.md section 5.8): how correctness is tested, per plan.md section 6.
 * All designed until CI produces committed report files in app/.
 */
export const proofs = ["convergenceTest", "strategyLaws", "simulator"] as const;

/** Clients (website.md section 4 / plan.md section 2). Dart/Flutter only as a roadmap line. */
export const clients = {
  v1: "TypeScript (browser + React Native)",
  planned: "Dart/Flutter client after v1",
} as const;
