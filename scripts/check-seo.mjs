// SEO check for the built site (runs after `next build`). Every page in out/ must have a unique
// <title> and meta description, a canonical URL, hreflang alternates (en, fr, x-default), Open
// Graph and Twitter images, exactly one <h1>, alt text on every image, and JSON-LD that parses.
// Also checks /llms.txt, /llms-full.txt, /robots.txt and /sitemap.xml exist and link each other.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const OUT = resolve("out");
if (!existsSync(OUT)) {
  console.error("[check-seo] out/ is missing — run `npm run build` first.");
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const pages = [...walk(OUT)].filter(
  (f) =>
    f.endsWith("index.html") &&
    !relative(OUT, f).startsWith("_") &&
    !relative(OUT, f).startsWith("404"),
);
const problems = [];
const titles = new Map();
const descriptions = new Map();
const attr = (html, re) => re.exec(html)?.[1];

for (const file of pages) {
  const rel = relative(OUT, file);
  const html = readFileSync(file, "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  const p = (m) => problems.push(`${rel}: ${m}`);

  const title = attr(head, /<title>([^<]+)<\/title>/);
  const description = attr(head, /<meta name="description" content="([^"]+)"/);
  if (!title) p("no <title>");
  else titles.set(title, [...(titles.get(title) ?? []), rel]);
  if (!description) p("no meta description");
  else descriptions.set(description, [...(descriptions.get(description) ?? []), rel]);
  if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(head)) p("no absolute canonical");
  for (const lang of ["en", "fr", "x-default"]) {
    if (!new RegExp(`<link rel="alternate" hrefLang="${lang}" href="https://`).test(head)) {
      p(`no hreflang="${lang}" alternate`);
    }
  }
  if (!/<meta property="og:image" content="https:\/\//.test(head)) p("no og:image");
  if (!/<meta name="twitter:card" content="summary_large_image"/.test(head)) p("no twitter:card");
  if (!/<meta name="twitter:image" content="https:\/\//.test(head)) p("no twitter:image");
  if (!/<meta name="robots" content="index, follow"/.test(head)) p("no robots meta");

  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) p(`${h1s} <h1> elements (expected 1)`);
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(img[0])) p(`image without alt: ${img[0].slice(0, 80)}`);
  }

  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (ld.length === 0) p("no JSON-LD");
  for (const [, json] of ld) {
    try {
      const data = JSON.parse(json);
      if (data["@context"] !== "https://schema.org") p("JSON-LD without schema.org @context");
    } catch (error) {
      p(`JSON-LD does not parse: ${error.message}`);
    }
  }
}

for (const [label, map] of [
  ["title", titles],
  ["description", descriptions],
]) {
  for (const [value, files] of map) {
    if (files.length > 1) problems.push(`duplicate ${label} "${value}" on ${files.join(", ")}`);
  }
}

const text = (name) => (existsSync(join(OUT, name)) ? readFileSync(join(OUT, name), "utf8") : null);
const llms = text("llms.txt");
if (!llms?.startsWith("# Accord\n\n> ")) problems.push("llms.txt: missing, or no H1 + blockquote");
if (!text("llms-full.txt")) problems.push("llms-full.txt is missing");
if (!text("robots.txt")?.includes("Sitemap: https://")) problems.push("robots.txt: no Sitemap");
const sitemap = text("sitemap.xml") ?? "";
const urls = sitemap.match(/<loc>/g)?.length ?? 0;
if (urls !== pages.length) {
  problems.push(`sitemap.xml lists ${urls} URLs, but out/ has ${pages.length} pages`);
}

if (problems.length > 0) {
  console.error(`\n[check-seo] ${problems.length} problem(s):\n  ${problems.join("\n  ")}\n`);
  process.exit(1);
}
console.log(
  `[check-seo] ${pages.length} pages: unique titles and descriptions, canonical, hreflang, social cards, one h1, valid JSON-LD; llms.txt, robots.txt and sitemap.xml present.`,
);
