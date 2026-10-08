// Fact-drift guard (website.md section 4). Every factual claim on the site must still
// be backed by its source: plan.md, or a file in the Accord repository. Sources are
// read from the committed snapshot in accord/ (refreshed with `npm run sync:app`),
// so the site builds from this repository alone; CI's drift job fails when the
// snapshot falls behind crossben/accordsync. For each fact we assert that key
// strings still appear in the source. When a source changes and a claim no longer
// holds, this fails the build until website/content/facts.ts and the copy that
// cites it are updated. That is intended.
//
// Also enforces website.md section 0's banned list on the copy itself, and guards the
// version fact: the moment CHANGELOG.md gains a v0.1.0 heading, the "in
// development" status line must be updated.
//
// Run in predev and prebuild; CI runs a drift job daily so drift in the Accord
// repository is caught even without a website change.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DOC_SNIPPETS, DOC_SOURCES } from "./doc-snippets.mjs";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = resolve(websiteRoot, "accord"); // the committed snapshot
const planFile = join(appDir, "plan.md");

const fail = (message) => {
  console.error(`\n[check-facts] ${message}\n`);
  process.exit(1);
};

// plan.md is hard-wrapped, so key strings are matched against
// whitespace-normalised text (newlines collapse to single spaces).
const normalize = (text) => text.replace(/\s+/g, " ");

if (!existsSync(appDir)) {
  fail(
    `The committed Accord snapshot does not exist: ${appDir}\n` +
      `  Run \`npm run sync:app\` from a checkout that has the Accord repository at\n` +
      `  ../app (or set ACCORD_APP_DIR), then commit accord/.`,
  );
}
if (!existsSync(planFile)) {
  fail(
    `plan.md is missing from the snapshot: ${planFile}\n` +
      `  The facts sheet cites it as the source for most claims (website.md section 4).\n` +
      `  Re-run \`npm run sync:app\` with ACCORD_PLAN_FILE pointing at plan.md, then commit it.`,
  );
}

let plan;
try {
  plan = readFileSync(planFile, "utf8");
} catch (error) {
  fail(`Cannot read ${planFile}: ${error.message}`);
}

const readSource = (base, file) => {
  const path = base === "plan" ? planFile : join(appDir, file);
  try {
    return { path, content: readFileSync(path, "utf8") };
  } catch {
    return { path, content: null };
  }
};

// Each fact: where it lives (base "plan" or "app" + file), and the key strings
// that must still be there. `appSource` adds a required backing file in app/
// for a fact that moved designed → built (cite the file, website.md section 4).
// `mustExist` asserts a file in app/ exists.
//
// tier "built" = backed by code AND a passing test in app/ (website.md section 4);
// moving a fact to built requires citing the file (and test) that prove it.
const FACTS = [
  {
    id: "name and meaning (built)",
    base: "plan",
    strings: ["## 0. The name: Accord", "every replica comes to an accord", "accordsync"],
  },
  {
    id: "what it is: open-source, self-hosted, SQLite/IndexedDB locally, PostgreSQL on the server",
    base: "plan",
    strings: [
      "field apps",
      "PostgreSQL (truth)",
      "device (SQLite)",
      "self-hosted server, open source",
    ],
  },
  {
    id: "local-first: writes never wait for the network",
    base: "plan",
    strings: ["locally first", "The network is never on the critical path of a user action"],
  },
  {
    id: "operations in an append-only log, replaying an op twice is a no-op",
    base: "plan",
    strings: ["not as row overwrites", "append-only log", "applying an op twice is a no-op"],
  },
  {
    id: "hybrid logical clocks; absurd clock skew is rejected",
    base: "plan",
    strings: ["Hybrid logical clocks", "absurd clock skew"],
  },
  {
    id: "merge strategies in v1: lww, counter, set, conflict (ordered lists out of v1)",
    base: "plan",
    strings: [
      "highest HLC wins",
      "sum of increments (PN-counter); never lost",
      "add-wins set (OR-set)",
      "both values kept",
      "out of v1",
    ],
  },
  {
    id: "conflict() fields are never auto-resolved",
    base: "plan",
    strings: ["conflict()", "is the honest answer", "never guesses on money or legal status"],
  },
  {
    id: "counters never lose an increment, under any delivery order",
    base: "plan",
    strings: ["sum of all increments ever made", "under any delivery order"],
  },
  {
    id: "resumable paged sync after days offline",
    base: "plan",
    strings: ["if it dies at page 7, it resumes at page 7"],
  },
  {
    id: "sync scopes enforced on the server; refused ops reported to the client",
    base: "plan",
    strings: ["Sync scopes", "never trusted to the client", "reported to the app as refused"],
  },
  {
    id: "convergence proven by property-based tests with network faults, reproducible by seed",
    base: "plan",
    strings: [
      "After all messages are delivered",
      "failures shrunk to a minimal example",
      "seeded runs that reproduce exactly",
    ],
  },
  {
    id: "stack: TypeScript everywhere; one pure merge core shared by client and server (built)",
    base: "plan",
    strings: ["TypeScript everywhere", "one pure merge core shared by client and server"],
    // Moved designed → built on 2026-10-02: ADR-0002 accepted, the pnpm
    // workspace exists and packages/client imports @accordsync/core.
    appSource: {
      file: "docs/adr/0002-typescript-everywhere.md",
      strings: [
        "Status: accepted",
        "TypeScript everywhere",
        "One pure core shared by client and server",
      ],
    },
  },
  {
    id: "implementations: TypeScript, Dart/Flutter, Python and Java clients; TypeScript, PHP, Python and Java servers",
    base: "app",
    file: "docs/flutter.md",
    strings: ["crossben/accordsync-dart"],
  },
  {
    id: "PHP server (Laravel, Symfony)",
    base: "app",
    file: "docs/php.md",
    strings: ["Laravel", "Symfony"],
  },
  {
    id: "Python client and server (FastAPI, Django)",
    base: "app",
    file: "docs/python.md",
    strings: ["FastAPI", "Django"],
  },
  {
    id: "Java client and server (Spring Boot)",
    base: "app",
    file: "docs/java.md",
    strings: ["Spring Boot", "io.github.crossben"],
  },
  {
    id: "licence: Apache-2.0 (built — app/README.md, section Licence and app/LICENSE, since M0)",
    base: "plan",
    strings: ["Apache-2.0"],
    appSource: { file: "README.md", strings: ["## Licence", "[Apache-2.0](LICENSE)"] },
    mustExist: "LICENSE",
  },
  {
    id: "what Accord is not",
    base: "plan",
    strings: [
      "Not a database.",
      "Not real-time collaboration on free text",
      "Not magic for business conflicts",
    ],
  },
  {
    id: "repository: crossben/accordsync (built)",
    base: "plan",
    strings: ["crossben/accordsync"],
  },
  {
    id: "problem story: kinds of field work, never named organisations",
    base: "plan",
    strings: ["enrolment agents, waste collectors, shopkeepers"],
  },
  {
    id: "quick start: npm create accord, then the template's commands (home page, section 5.9)",
    base: "app",
    file: "packages/create-accord/template/README.md",
    strings: [
      "safe-install install",
      "docker compose up -d",
      "cp .env.example .env",
      "safe-install run server",
      "safe-install run client",
      "safe-install run token -- <user>",
      "With npm instead: `npm install`, then `npm run server` and `npm run client`.",
    ],
    appSource: { file: "packages/create-accord/README.md", strings: ["npm create accord my-app"] },
  },
  {
    id: "safe-install: installs with every install script off, runs none until approved (facts.safeInstall)",
    base: "app",
    file: "README.md",
    strings: [
      "**Why safe-install.**",
      "Installing a package can run its install scripts",
      "installs with every install script off and runs none until you approve it",
      "https://safe-install.benhattab.pro",
    ],
    appSource: {
      file: "packages/create-accord/template/README.md",
      strings: ["installs packages with every install script off and asks before running any"],
    },
  },
  {
    id: "quick start output: what the example client prints after syncing (facts.quickstartOutput)",
    base: "app",
    file: "packages/create-accord/template/client.ts",
    strings: [
      "console.log('after sync:', accord.status().pending, 'pending; the server has it.');",
    ],
  },
  {
    id: "version 0.3.2, released 2026-10-08 (facts.version)",
    base: "app",
    file: "CHANGELOG.md",
    strings: ["## [0.3.2] - 2026-10-08"],
    appSource: { file: "README.md", strings: ["Status: v0.3.2"] },
  },
  // Built on 2026-10-02: each guarantee cites the test that proves it (facts.guarantees).
  {
    id: "guarantee: every replica converges (built)",
    base: "app",
    file: "packages/simulator/src/convergence.test.ts",
    strings: ["every replica converges, whatever the network does"],
  },
  {
    id: "guarantee: counters never lose an increment (built)",
    base: "app",
    file: "packages/simulator/src/convergence.test.ts",
    strings: ["No lost increments: every counter equals the sum of every increment"],
  },
  {
    id: "guarantee: conflict() is never auto-resolved (built)",
    base: "app",
    file: "packages/core/src/laws.test.ts",
    strings: ["a conflict() field written concurrently is never auto-resolved"],
  },
  {
    id: "guarantee: replayed ops change nothing (built)",
    base: "app",
    file: "packages/server/test/sync.test.ts",
    strings: ["a retried push is acknowledged again and stored once"],
  },
  {
    id: "guarantee: sync resumes in pages (built)",
    base: "app",
    file: "packages/server/test/sync.test.ts",
    strings: ["pages through a long backlog and resumes from its cursor"],
  },
  {
    id: "guarantee: scopes enforced on the server, refused ops rolled back (built)",
    base: "app",
    file: "packages/server/test/sync.test.ts",
    strings: ["refuses writes to someone else's record, with a reason"],
    appSource: {
      file: "docs/adr/0006-refused-ops-roll-back.md",
      strings: ["Refused ops are rolled back on the device that wrote them"],
    },
  },
  {
    id: "strategies: lww, counter, set, conflict built, with golden vectors (facts.strategies)",
    base: "app",
    file: "docs/merge-rules.md",
    strings: ["| `lww` |", "| `counter` |", "| `set` |", "| `conflict` |"],
    mustExist: "vectors/conflict.json",
  },
  {
    id: "proof: CI case counts (facts.ciRuns)",
    base: "app",
    file: ".github/workflows/ci.yml",
    strings: ["ACCORD_SIM_RUNS: '3000'", "ACCORD_PROPERTY_RUNS: '2000'"],
  },
  {
    id: "load test numbers and hardware (facts.loadTest)",
    base: "app",
    file: "load/README.md",
    strings: ["Intel Core i7-11800H", "## Results: v0.2", "ACCORD_WORKERS"],
  },
  {
    id: "security and contributing files (features.repoLinks)",
    base: "app",
    file: "SECURITY.md",
    strings: ["Report a vulnerability"],
    mustExist: "CONTRIBUTING.md",
  },
  {
    id: "field-app screenshot is a real capture (facts.screenshot)",
    base: "app",
    file: "examples/field-app/src/App.tsx",
    strings: ["Agents disagree.", "Accord kept every value. Which one is right?"],
    appSource: {
      file: "examples/field-app/README.md",
      strings: ["docs/screens/field-app-conflict.png"],
    },
    mustExist: "docs/screens/field-app-conflict.png",
  },
  {
    id: "new packages on npm: @accordsync/react and create-accord (versions = facts.version)",
    base: "app",
    file: "packages/react/package.json",
    strings: ['"name": "@accordsync/react"'],
    appSource: {
      file: "packages/create-accord/package.json",
      strings: ['"name": "create-accord"'],
    },
  },
  ...["core", "client", "server", "react", "simulator", "create-accord"].map((pkg) => ({
    id: `registries: npm package packages/${pkg} (facts.registries)`,
    base: "app",
    file: `packages/${pkg}/package.json`,
    strings: [`"name": "${pkg === "create-accord" ? pkg : `@accordsync/${pkg}`}"`],
  })),
  {
    id: "registries: Dart packages and repository (facts.registries, facts.languageRepos)",
    base: "app",
    file: "docs/flutter.md",
    strings: [
      "`accordsync_flutter`",
      "`accordsync`",
      "`accordsync_core`",
      "github.com/crossben/accordsync-dart",
    ],
  },
  {
    id: "registries: PHP packages and repository (facts.registries, facts.languageRepos)",
    base: "app",
    file: "docs/php.md",
    strings: [
      "`accordsync/laravel`",
      "`accordsync/symfony`",
      "`accordsync/server`",
      "`accordsync/core`",
      "github.com/crossben/accordsync-php",
    ],
  },
  {
    id: "registries: Python packages and repository (facts.registries, facts.languageRepos)",
    base: "app",
    file: "docs/python.md",
    strings: [
      "`accordsync`",
      "`accordsync-fastapi`",
      "`accordsync-django`",
      "`accordsync-server`",
      "`accordsync-core`",
      "github.com/crossben/accordsync-python",
    ],
  },
  {
    id: "registries: Java artifacts and repository (facts.registries, facts.languageRepos)",
    base: "app",
    file: "docs/java.md",
    strings: [
      "`accordsync-client`",
      "`accordsync-spring-boot-starter`",
      "`accordsync-server`",
      "`accordsync-core`",
      "github.com/crossben/accordsync-java",
    ],
  },
  // The docs pages (docs.md): every cited file, and every snippet marker, must still be there.
  ...DOC_SOURCES.map((file) => ({
    id: `docs page source ${file}`,
    base: "app",
    file,
    strings: [],
  })),
  ...Object.entries(DOC_SNIPPETS).map(([id, { file, marker }]) => ({
    id: `docs snippet ${id}`,
    base: "app",
    file,
    strings: [marker],
  })),
];

// website.md section 0 — reviewers reject these on sight. Scan the copy itself, not
// only the facts sheet: nothing in content/ may contain them. (The precise,
// allowed claim is "never lose an increment", not "never lose data".)
const BANNED = [
  "production-ready",
  "battle-tested",
  "enterprise-grade",
  "blazing fast",
  "zero conflicts",
  "never lose data",
  "trusted by",
  // Named organisations from the owner's past projects must never appear as
  // users or customers (website.md section 0).
  "CPI",
  "Ekolo",
  "Komizi",
  "ShopAgent",
];

const COPY_FILES = ["content/en.ts", "content/fr.ts", "content/facts.ts", "content/features.ts"];

const problems = [];

const checkStrings = (fact, source, strings) => {
  for (const s of strings) {
    if (!normalize(source.content).includes(normalize(s))) {
      problems.push(
        `  ${fact.id}\n    expected in ${source.path}: ${JSON.stringify(s.length > 72 ? s.slice(0, 69) + "..." : s)}`,
      );
    }
  }
};

for (const fact of FACTS) {
  const primary = readSource(fact.base, fact.file);
  if (primary.content === null) {
    problems.push(`  ${fact.id}\n    cited source missing: ${primary.path}`);
  } else {
    checkStrings(fact, primary, fact.strings);
  }
  if (fact.appSource) {
    const source = readSource("app", fact.appSource.file);
    if (source.content === null) {
      problems.push(
        `  ${fact.id}\n    cited app/ backing file missing: ${source.path} (the fact must go back to "designed")`,
      );
    } else {
      checkStrings(fact, source, fact.appSource.strings);
    }
  }
  if (fact.mustExist) {
    const path = join(appDir, fact.mustExist);
    if (!existsSync(path)) {
      problems.push(`  ${fact.id}\n    cited file missing: ${path}`);
    }
  }
  if (fact.tier === "built" && fact.test) {
    const path = join(appDir, fact.test);
    if (!existsSync(path)) {
      problems.push(`  ${fact.id}\n    cited test file missing: ${path}`);
    }
  }
}

for (const file of COPY_FILES) {
  const path = join(websiteRoot, file);
  if (!existsSync(path)) {
    problems.push(`  copy file missing: ${file}`);
    continue;
  }
  const content = readFileSync(path, "utf8");
  for (const banned of BANNED) {
    if (content.includes(banned)) {
      problems.push(
        `  ${file} contains a banned claim (website.md section 0): ${JSON.stringify(banned)}`,
      );
    }
  }
}

// Version guard (website.md section 4): facts.version must match the latest release heading.
const changelogPath = join(appDir, "CHANGELOG.md");
const factsSource = readFileSync(join(websiteRoot, "content/facts.ts"), "utf8");
const siteVersion = /version = \{ number: "([^"]+)", date: "([^"]+)" \}/.exec(factsSource);
if (!existsSync(changelogPath)) {
  problems.push(
    `  app/CHANGELOG.md is missing — the version fact (website.md section 4) cites it.`,
  );
} else if (!siteVersion) {
  problems.push(`  content/facts.ts: cannot read \`version\` (expected { number, date }).`);
} else {
  const latest = /^##\s*\[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/m.exec(
    readFileSync(changelogPath, "utf8"),
  );
  if (!latest || latest[1] !== siteVersion[1] || latest[2] !== siteVersion[2]) {
    problems.push(
      `  app/CHANGELOG.md's latest release is ${latest ? `${latest[1]} (${latest[2]})` : "missing"},\n` +
        `  but facts.version says ${siteVersion[1]} (${siteVersion[2]}). Update them in the same PR.`,
    );
  }
}

// Package versions in the snapshot must equal the site's version (the docs pages say "v<version>").
if (siteVersion) {
  for (const pkg of ["core", "client", "server", "react", "simulator", "create-accord"]) {
    const file = join(appDir, "packages", pkg, "package.json");
    const v = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).version : null;
    if (v !== siteVersion[1]) {
      problems.push(
        `  packages/${pkg} is ${v ?? "missing"}, but facts.version says ${siteVersion[1]}`,
      );
    }
  }
}

// The playground runs the published packages pinned in package.json: same version as the site says.
if (siteVersion) {
  const pkg = JSON.parse(readFileSync(join(websiteRoot, "package.json"), "utf8"));
  for (const dep of ["@accordsync/core", "@accordsync/simulator"]) {
    if (pkg.dependencies?.[dep] !== siteVersion[1]) {
      problems.push(
        `  package.json pins ${dep} at ${pkg.dependencies?.[dep] ?? "nothing"}; the playground must run ${siteVersion[1]}`,
      );
    }
  }
}

// Load numbers on the site (facts.loadTest.rows) must be the ones in app/load/README.md.
const loadReadme = normalize(readSource("app", "load/README.md").content ?? "");
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
for (const m of factsSource.matchAll(
  /\{ devices: (\d+), workers: (\d+), opsPerSec: (\d+), pushP95: (\d+), pullP95: (\d+) \}/g,
)) {
  const [, devices, workers, ops, push, pull] = m;
  const row = new RegExp(
    `\\| ${devices} \\| ${workers} \\| ${group(ops)} \\| [^|]+ \\| ${group(push)} ms \\| [^|]+ \\| [^|]+ \\| ${pull} ms \\|`,
  );
  if (!row.test(loadReadme)) {
    problems.push(
      `  facts.loadTest row for ${devices} devices, ${workers} workers does not match app/load/README.md`,
    );
  }
}

if (problems.length > 0) {
  console.error(
    `\n[check-facts] The website makes claims its sources no longer back up:\n` +
      problems.join("\n") +
      `\n\n[check-facts] Update website/content/facts.ts (and the copy citing it) to match the\n` +
      `[check-facts] sources. Never modify the Accord repository from here (website.md section 9).\n`,
  );
  process.exit(1);
}

console.log(
  `[check-facts] All ${FACTS.length} facts still trace to their sources; the banned-claims scan is clean.`,
);
