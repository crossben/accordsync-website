// Snapshot sync (the Yoon `sync:gateway` pattern): the website reads the
// Accord sources it makes claims about — plan.md, README, CHANGELOG, LICENSE,
// ADRs, package sources — from the committed snapshot in accord/, NOT from a
// sibling checkout. That way the site builds (and deploys) from this
// repository alone, and CI's drift job fails when the snapshot falls behind
// the real repository.
//
// Usage:
//   npm run sync:app          refresh accord/ from $ACCORD_APP_DIR (default ../app)
//   node scripts/sync-app.mjs --require   same, but fail if the source is missing
//                             (used by CI's drift job)
//   ACCORD_PLAN_FILE=…        where plan.md lives (default ../plan.md)
//
// The website repo never writes to the Accord repository (website.md section 9):
// this script only reads it.
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = process.env.ACCORD_APP_DIR
  ? resolve(process.env.ACCORD_APP_DIR)
  : resolve(websiteRoot, "../app");
const planFile = process.env.ACCORD_PLAN_FILE
  ? resolve(process.env.ACCORD_PLAN_FILE)
  : resolve(websiteRoot, "../plan.md");
const dest = resolve(websiteRoot, "accord");

const requireSource = process.argv.includes("--require");

// A real Accord checkout, not something that merely sits at the path (in a
// Docker builder, ../app resolves to the website root itself).
const isAccordRepo = (dir) =>
  existsSync(join(dir, "package.json")) && existsSync(join(dir, "packages", "core"));

if (!isAccordRepo(appDir)) {
  const note =
    `[sync:app] No Accord repository found at ${appDir} — using the committed\n` +
    `[sync:app] snapshot in accord/ as-is. Set ACCORD_APP_DIR to a checkout and\n` +
    `[sync:app] re-run to refresh it.`;
  if (requireSource) {
    console.error(`\n[sync:app] ${note.replace("— using", "\n[sync:app] — using")}\n`);
    process.exit(1);
  }
  console.log(note);
  process.exit(0);
}

// Source files only: no installs, no git history, no build outputs.
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist"]);
const excluded = (rel) => {
  const parts = relative(appDir, rel).split(/[\\/]/);
  return parts.some((p) => EXCLUDED_DIRS.has(p)) || parts.some((p) => p.endsWith(".tsbuildinfo"));
};

// plan.md lives outside the Accord repository. Where it is not available (CI), keep the committed
// copy: remember it before the snapshot is wiped, and put it back afterwards.
const committedPlan = join(dest, "plan.md");
const keptPlan =
  !existsSync(planFile) && existsSync(committedPlan) ? readFileSync(committedPlan) : null;

rmSync(dest, { recursive: true, force: true });
cpSync(appDir, dest, {
  recursive: true,
  filter: (src) => {
    if (statSync(src).isDirectory()) return !excluded(src);
    return true;
  },
});
// plan.md travels with the snapshot: most facts cite it (website.md section 4).
if (existsSync(planFile)) {
  cpSync(planFile, join(dest, "plan.md"));
} else if (keptPlan) {
  writeFileSync(committedPlan, keptPlan);
  console.log(
    `[sync:app] Note: plan.md not found at ${planFile} — the committed copy in\n` +
      `[sync:app] accord/plan.md (if any) is kept. Set ACCORD_PLAN_FILE to override.`,
  );
}

const files = (function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
})(dest);
let count = 0;
for (const _ of files) count++;
console.log(
  `[sync:app] Refreshed accord/ from ${appDir} (${count} files). Commit it with the facts it backs.`,
);
