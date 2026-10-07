// Link checker for the built site (website.md section 8). Scans every HTML file in
// out/ for href/src and verifies:
//   - internal links and assets exist in out/ (anchors checked too);
//   - every external link points at an allow-listed domain (the site must make
//     no third-party requests; section 10 checklist);
//   - GitHub links point at the owner's repositories only.
// Runs offline: no network calls. Usage: node scripts/check-links.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const OUT = resolve("out");
// accord.benhattab.pro is the provisional canonical domain (website.md section 11 —
// the owner has not picked the final one yet). Update with the domain.
const SITE = "https://accord.benhattab.pro";
const ALLOWED_EXTERNAL_HOSTS = ["github.com", "accord.benhattab.pro", "safe-install.benhattab.pro"];
const GITHUB_REPOS = ["crossben/accordsync", "crossben/accordsync-website"];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const htmlFiles = [...walk(OUT)].filter((f) => [".html", ".xml", ".txt"].includes(extname(f)));
if (htmlFiles.length === 0) {
  console.error("[check-links] out/ is empty — run `npm run build` first.");
  process.exit(1);
}
const problems = [];
let linkCount = 0;

const URL_RE = /(?:href|src)="([^"]+)"/g;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const relFile = relative(OUT, file);
  const seen = new Set();
  for (const match of html.matchAll(URL_RE)) {
    const raw = match[1];
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("data:")) continue;
    linkCount++;

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      let host;
      try {
        host = new URL(raw).host;
      } catch {
        problems.push(`${relFile}: unparseable URL ${raw}`);
        continue;
      }
      if (!ALLOWED_EXTERNAL_HOSTS.includes(host)) {
        problems.push(`${relFile}: external link to a non-allow-listed domain: ${raw}`);
      }
      if (
        host === "github.com" &&
        !GITHUB_REPOS.some((r) => raw.startsWith(`https://github.com/${r}`)) &&
        raw !== "https://github.com/crossben" // the owner's profile (metadata authors, JSON-LD)
      ) {
        problems.push(`${relFile}: GitHub link outside the owner's repositories: ${raw}`);
      }
      if (host === "accord.benhattab.pro") {
        const sitePath = new URL(raw).pathname;
        const siteTarget = sitePath.endsWith("/")
          ? join(OUT, sitePath, "index.html")
          : join(OUT, sitePath);
        if (!existsSync(siteTarget)) {
          problems.push(`${relFile}: site URL ${raw} does not exist in out/`);
        }
      }
      continue;
    }

    // internal: strip the anchor; "/" resolves from out/, relative from the file's dir
    const [pathPart, anchor] = raw.split("#");
    const baseDir = pathPart.startsWith("/")
      ? OUT
      : join(OUT, relFile.split("/").slice(0, -1).join("/"));
    let target = resolve(baseDir, decodeURIComponent(pathPart.replace(/^\//, "")));
    // directories → their index file (hosts serve /dir/ as dir/index.html)
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");

    if (!existsSync(target)) {
      problems.push(`${relFile}: broken internal link ${raw}`);
      continue;
    }
    if (anchor && extname(target) === ".html") {
      const targetHtml = readFileSync(target, "utf8");
      const id = new RegExp(`id="${anchor}"|id='${anchor}'`);
      if (!id.test(targetHtml)) {
        problems.push(
          `${relFile}: link ${raw} — anchor "#${anchor}" not found in ${relative(OUT, target)}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`\n[check-links] ${problems.length} problem(s) found:\n${problems.join("\n")}\n`);
  process.exit(1);
}
console.log(
  `[check-links] ${linkCount} links across ${htmlFiles.length} files: all internal links resolve, all external links are on the allow-list.`,
);
