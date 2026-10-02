// Snippet type-check (website.md section 5.6 and section 9): content/snippets/*.ts
// must type-check against the real app/packages/core and app/packages/client.
// The snippets are the "Your code" tab; when this check passes,
// features.snippetsCheckedAgainstApp is true and the site shows them as real,
// preview-labelled code. When the packages are missing, it skips with a clear
// message and the site must keep the "API preview" label.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = process.env.ACCORD_APP_DIR
  ? resolve(process.env.ACCORD_APP_DIR)
  : resolve(websiteRoot, "../app");

const corePkg = join(appDir, "packages", "core", "package.json");
const clientPkg = join(appDir, "packages", "client", "package.json");

if (!existsSync(corePkg) || !existsSync(clientPkg)) {
  console.log(
    "[check:snippets] Skipped: app/packages/core and app/packages/client do not exist yet.\n" +
      "[check:snippets] The site must keep the \u201CAPI preview: may change before v0.1\u201D label.",
  );
  process.exit(0);
}

// Type-check against the packages' SOURCE entry points (the single source of
// truth for their API; relative imports inside the packages resolve normally).
const tmp = mkdtempSync(join(websiteRoot, ".snippets-check-"));
try {
  writeFileSync(
    join(tmp, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "esnext"],
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          paths: {
            "@accordsync/core": [join(appDir, "packages/core/src/index.ts")],
            "@accordsync/client": [join(appDir, "packages/client/src/index.ts")],
          },
        },
        include: [join(websiteRoot, "content/snippets/**/*.ts")],
      },
      null,
      2,
    ),
  );
  execFileSync(join(websiteRoot, "node_modules/.bin/tsc"), ["-p", join(tmp, "tsconfig.json")], {
    stdio: "inherit",
  });
  console.log("[check:snippets] All snippets type-check against the app/ packages.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
