import { licence, npmName, repo, version } from "@/content/facts";

// /llms.txt — the convention for making a site legible to LLM crawlers
// (https://llmstxt.org): an H1, a blockquote summary, then curated sections of
// links. Generated from content/facts.ts at build time so it cannot drift from
// the facts sheet, and exported as a static file. Only facts appear here.
export const dynamic = "force-static";

const SITE = "https://accord.benhattab.pro";

export function GET() {
  const status = `v${version.number} (${version.date}), pre-1.0`;
  const body = `# Accord

> Accord is an open-source, self-hosted, offline-first sync engine in
> development for field apps: apps write locally first (SQLite or IndexedDB),
> changes are operations in an append-only log ordered by hybrid logical
> clocks, and on reconnect every replica converges by declared per-field merge
> rules — \`lww\`, \`counter\` (a PN-counter), \`set\` (add-wins) and
> \`conflict()\` (never auto-resolved: the app decides). TypeScript everywhere,
> PostgreSQL on the server, Apache-2.0.

Status: ${status}. The site is a one-page introduction in English and French.
Illustrations on the page show how the sync is designed to work; they are not
live views, and no performance numbers are claimed anywhere.

## Page

- [Home (English)](${SITE}/): the problem, how sync works, the merge rules,
  the planned guarantees, an API-preview code tab, the proof plan, a quick
  start, what Accord is not, and the licence.
- [Accueil (Français)](${SITE}/fr/): the same page in French.

## Repository

- [crossben/accordsync](${repo.home}): the Accord source of truth. Facts on
  the site are checked against it at build time.
- [README](${repo.blob}/README.md): what Accord is and is not, the repository
  layout, and the develop guide.
- [CHANGELOG](${repo.changelog}): releases (latest: v${version.number}).
- [Architecture decisions](${repo.blob}/docs/adr): why Accord, TypeScript
  everywhere, merge strategies v1, scope exit, compaction and device TTL.
- [Licence](${repo.license}): ${licence.accord}.

## Facts (for accuracy)

- Status: ${status}.
- Licence: ${licence.accord}. The npm name \`${npmName}\` is used only in code
  and install commands; the project is called Accord in prose.
- v1 clients: TypeScript (browser and React Native). A Dart/Flutter client is
  planned after v1, as are ordered lists and attachments.
- Merge strategies in v1: \`lww\` (highest HLC wins), \`counter\` (sum of
  increments, none lost), \`set\` (add-wins), \`conflict\` (both values kept,
  flagged, the app decides).
- Sync scopes are enforced on the server; refused ops are reported back to the
  client. Sync is resumable in pages after days offline.
- Guarantees on the site are marked Planned until a passing test in the
  repository proves them. Load-test numbers do not exist yet.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
