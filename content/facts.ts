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
 * Version. Source: app/CHANGELOG.md ("## [0.3.0] - 2026-10-07") and app/README.md's status note
 * ("Status: v0.3.0"). check-facts.mjs fails the build if either changes.
 */
export const version = { number: "0.3.0", date: "2026-10-07" } as const;

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
 * Load test (website.md section 4): app/load/README.md, v0.2 results, measured 2026-10-03. Always shown with
 * its hardware line and caveat.
 */
export const loadTest = {
  source: `${BLOB}/load/README.md`,
  version: "0.2",
  hardware: "Intel Core i7-11800H laptop, 31 GiB RAM, PostgreSQL 16 defaults",
  rows: [
    { devices: 50, workers: 1, opsPerSec: 1840, pushP95: 297, pullP95: 46 },
    { devices: 100, workers: 1, opsPerSec: 1594, pushP95: 658, pullP95: 52 },
    { devices: 200, workers: 1, opsPerSec: 1682, pushP95: 1483, pullP95: 55 },
    { devices: 50, workers: 4, opsPerSec: 2998, pushP95: 194, pullP95: 50 },
    { devices: 100, workers: 4, opsPerSec: 2860, pushP95: 437, pullP95: 56 },
    { devices: 200, workers: 4, opsPerSec: 3039, pushP95: 808, pullP95: 56 },
  ],
} as const;

/** Real screenshot of app/examples/field-app (app/docs/screens/), copied to public/screens/. */
export const screenshot = {
  src: "/screens/field-app-conflict.webp",
  width: 1040,
  height: 815,
  example: `${REPO_BASE}/tree/main/examples/field-app`,
} as const;

/** Implementations: clients and servers, each documented in the Accord repository's docs/. */
export const clients = {
  clients: "TypeScript (browser + React Native), Dart/Flutter, Python",
  servers: "TypeScript (Node), PHP (Laravel, Symfony), Python (FastAPI, Django)",
} as const;

/**
 * The playground (website.md section 5.7). It runs the published packages, so this is a fact about
 * the website's own dependencies: package.json pins both to the same version as `version.number`,
 * and check-facts.mjs asserts that pin still matches. Source: website/package.json.
 */
export const playground = {
  core: "@accordsync/core",
  simulator: "@accordsync/simulator",
  version: version.number,
} as const;

/**
 * The quick start's last line of output: what the client of a project made with `npm create accord`
 * prints after it syncs. Source: app/packages/create-accord/template/client.ts (check-facts).
 */
/**
 * safe-install: the owner's installer, used in every install command on the site. It installs with
 * every lifecycle script off and asks before running any. Source: app/README.md ("Why
 * safe-install") and the generated project's README (check-facts).
 */
export const safeInstall = {
  home: "https://safe-install.benhattab.pro",
  llms: "https://safe-install.benhattab.pro/llms.txt",
} as const;

/**
 * Published packages per registry, and the per-language repositories. Source: the package tables in
 * app/README.md, docs/flutter.md, docs/php.md and docs/python.md (check-facts requires each name).
 */
export const registries = [
  {
    label: "npm (TypeScript)",
    source: "packages/*/package.json",
    packages: [
      "@accordsync/client",
      "@accordsync/server",
      "@accordsync/react",
      "@accordsync/core",
      "@accordsync/simulator",
      "create-accord",
    ],
    url: (name: string) => `https://www.npmjs.com/package/${name}`,
  },
  {
    label: "pub.dev (Dart/Flutter)",
    source: "docs/flutter.md",
    packages: ["accordsync_flutter", "accordsync", "accordsync_core"],
    url: (name: string) => `https://pub.dev/packages/${name}`,
  },
  {
    label: "Packagist (PHP)",
    source: "docs/php.md",
    packages: ["accordsync/laravel", "accordsync/symfony", "accordsync/server", "accordsync/core"],
    url: (name: string) => `https://packagist.org/packages/${name}`,
  },
  {
    label: "PyPI (Python)",
    source: "docs/python.md",
    packages: [
      "accordsync",
      "accordsync-fastapi",
      "accordsync-django",
      "accordsync-server",
      "accordsync-core",
    ],
    url: (name: string) => `https://pypi.org/project/${name}/`,
  },
] as const;

/** The other implementations' repositories, as linked from the Accord docs. */
export const languageRepos = [
  {
    name: "accordsync-dart",
    url: "https://github.com/crossben/accordsync-dart",
    source: "docs/flutter.md",
  },
  {
    name: "accordsync-php",
    url: "https://github.com/crossben/accordsync-php",
    source: "docs/php.md",
  },
  {
    name: "accordsync-python",
    url: "https://github.com/crossben/accordsync-python",
    source: "docs/python.md",
  },
] as const;

export const quickstartOutput = "after sync: 0 pending; the server has it.";
