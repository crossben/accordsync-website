// Fact-drift guard (website.md section 4). Every factual claim on the site must still
// be backed by its source: ../plan.md, or a file in the Accord repository
// ($ACCORD_APP_DIR, default ../app — read, never modified). For each fact we
// assert that key strings still appear in the source. When a source changes and
// a claim no longer holds, this fails the build until website/content/facts.ts
// and the copy that cites it are updated. That is intended.
//
// Also enforces website.md section 0's banned list on the copy itself, and guards the
// version fact: the moment app/CHANGELOG.md gains a v0.1.0 heading, the "in
// development" status line must be updated.
//
// Run in predev and prebuild; CI runs it daily so drift in app/ is caught.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = process.env.ACCORD_APP_DIR
  ? resolve(process.env.ACCORD_APP_DIR)
  : resolve(websiteRoot, "../app");
const planFile = process.env.ACCORD_PLAN_FILE
  ? resolve(process.env.ACCORD_PLAN_FILE)
  : resolve(websiteRoot, "../plan.md");

const fail = (message) => {
  console.error(`\n[check-facts] ${message}\n`);
  process.exit(1);
};

// plan.md is hard-wrapped, so key strings are matched against
// whitespace-normalised text (newlines collapse to single spaces).
const normalize = (text) => text.replace(/\s+/g, " ");

if (!existsSync(appDir)) {
  fail(
    `The Accord repository directory does not exist: ${appDir}\n` +
      `  Clone crossben/accordsync there (or set ACCORD_APP_DIR). CI checks it out into website/app/.`,
  );
}
if (!existsSync(planFile)) {
  fail(
    `plan.md does not exist: ${planFile}\n` +
      `  The facts sheet cites it as the source for most claims (website.md section 4).`,
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
    id: "clients: TypeScript in v1; Dart/Flutter planned after v1",
    base: "plan",
    strings: ["TypeScript client", "Dart/Flutter client comes after v1"],
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
    id: "quick start: Docker Compose + health check (app/README.md, section Develop, since M0)",
    base: "app",
    file: "README.md",
    strings: ["docker compose up --build", "curl localhost:8080/health", "Node 22.12+"],
  },
  {
    id: "health response shape (packages/server/test/health.test.ts)",
    base: "app",
    file: "packages/server/test/health.test.ts",
    strings: ["protocolVersion: 1"],
  },
  {
    id: "status line: in development, not released (app/README.md status note)",
    base: "app",
    file: "README.md",
    strings: ["in development, not released"],
  },
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

// Version guard (website.md section 4): no version until v0.1.0 is tagged. If the
// changelog now carries the tag, the "in development" status line is wrong.
const changelogPath = join(appDir, "CHANGELOG.md");
if (!existsSync(changelogPath)) {
  problems.push(
    `  app/CHANGELOG.md is missing — the version fact (website.md section 4) cites it.`,
  );
} else {
  const changelog = readFileSync(changelogPath, "utf8");
  const released = /^##\s*\[?v?\d+\.\d+\.\d+\]?/m.test(changelog);
  const unreleased = /^##\s*\[Unreleased\]/m.test(changelog);
  if (released) {
    problems.push(
      `  app/CHANGELOG.md now contains a release heading: the site's status line and\n` +
        `  facts.ts still say "in development". Update them in the same PR.`,
    );
  } else if (!unreleased) {
    problems.push(
      `  app/CHANGELOG.md has neither an [Unreleased] section nor a release heading —\n` +
        `  its structure changed; revisit the version fact (website.md section 4).`,
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
