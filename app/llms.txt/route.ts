import { licence, repo, version } from "@/content/facts";
import { en } from "@/content/en";
import { docsHref, docsPages } from "@/lib/docsPages";

// /llms.txt — the convention for making a site legible to LLM crawlers
// (https://llmstxt.org): an H1, a blockquote summary, then curated sections of
// links. Generated from content/facts.ts at build time so it cannot drift from
// the facts sheet, and exported as a static file. Only facts appear here.
export const dynamic = "force-static";

const SITE = "https://accord.benhattab.pro";

export function GET() {
  const status = `v${version.number} (${version.date}), pre-1.0`;
  const docsLines = docsPages
    .map(
      (p) =>
        `- [${en.docs.pages[p.slug].title}](${SITE}${docsHref("en", p.slug)}): ${en.docs.pages[p.slug].description}`,
    )
    .join("\n");
  const body = `# Accord

> Accord is an open-source, self-hosted, offline-first sync engine for field
> apps: apps write locally first (SQLite or IndexedDB), changes are operations
> in an append-only log ordered by hybrid logical clocks, and on reconnect every
> replica converges by declared per-field merge rules — \`lww\`, \`counter\`
> (a PN-counter), \`set\` (add-wins) and \`conflict()\` (never auto-resolved:
> the app decides). TypeScript everywhere, PostgreSQL on the server, Apache-2.0.

Status: ${status}. Packages on npm: @accordsync/core, @accordsync/client,
@accordsync/server, @accordsync/react, @accordsync/simulator and
create-accord (\`npm create accord my-app\`).

## Site

- [Home (English)](${SITE}/): the problem, how sync works, the merge rules,
  the guarantees with the tests that prove them, code, proof and load results,
  a quick start, what Accord is not, and the licence.
- [Accueil (Français)](${SITE}/fr/): the same page in French.
- [Docs](${SITE}/docs/): developer documentation (also in French at /fr/docs/).

## Docs

${docsLines}

## Repository

- [crossben/accordsync](${repo.home}): the source of truth. Facts and code
  examples on the site are checked against it at build time.
- [CHANGELOG](${repo.changelog}): releases (latest: v${version.number}).
- [Architecture decisions](${repo.blob}/docs/adr): every design decision and why.
- [Licence](${repo.license}): ${licence.accord}.

## Facts (for accuracy)

- Status: ${status}. Licence: ${licence.accord}.
- Clients: TypeScript (browser and React Native), with React hooks. A
  Dart/Flutter client, ordered lists and attachments are planned.
- Guarantees (convergence, no lost increments, conflict() never
  auto-resolved, idempotent ops, resumable sync, server-side scopes) are each
  backed by a test in the repository.
- Load results, with hardware and caveats, are in load/README.md in the
  repository.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
