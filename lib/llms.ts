// /llms.txt and /llms-full.txt (https://llmstxt.org), generated at build time from the facts sheet,
// the English copy and the verbatim docs snippets, so they cannot drift from the site.
import {
  clients,
  languageRepos,
  licence,
  registries,
  repo,
  safeInstall,
  strategies,
  version,
} from "@/content/facts";
import { en } from "@/content/en";
import { docSnippet, type DocSnippetId } from "@/lib/docs";
import { SITE, docsHref, docsPages } from "@/lib/docsPages";

const docsUrl = (slug = "") => `${SITE}${docsHref("en", slug)}`;
const fence = (id: DocSnippetId) => {
  const s = docSnippet(id);
  const lang = s.lang === "bash" ? "sh" : s.lang === "text" ? "" : s.lang;
  return `\`\`\`${lang}\n${s.code}\n\`\`\``;
};

/** Pages with a "Prompt for an AI coding agent" section. */
const agentPages = docsPages.filter((p) =>
  (p.sections as readonly { key: string }[]).some((s) => s.key === "agent"),
);

const mergeRules = () =>
  strategies
    .map(({ id }) => {
      const row = en.merges.table.rows[id];
      return `- \`${id === "conflict" ? "conflict()" : id}\`: ${row.rule} Use for: ${row.useFor.toLowerCase()}.`;
    })
    .join("\n");

const quickstartCommands = () => en.quickstart.steps.flatMap((s) => s.commands).join("\n");

export function llmsTxt(): string {
  const docs = docsPages
    .map(
      (p) =>
        `- [${en.docs.pages[p.slug].title}](${docsUrl(p.slug)}): ${en.docs.pages[p.slug].description}`,
    )
    .join("\n");
  const packages = registries
    .map((r) => `- ${r.label}: ${r.packages.map((name) => `[${name}](${r.url(name)})`).join(", ")}`)
    .join("\n");
  const prompts = agentPages
    .map((p) => `[${en.docs.pages[p.slug].title}](${docsUrl(p.slug)}#agent)`)
    .join(", ");

  return `# Accord

> ${en.meta.description}

${en.docs.index.intro}

Latest release: v${version.number} (${version.date}), pre-1.0. Licence: ${licence.accord}.

Implementations, all speaking the same sync protocol and merging by the same rules:

- Clients: ${clients.clients}.
- Servers: ${clients.servers}.

The four merge rules, declared per field in the schema:

${mergeRules()}

## Docs

${docs}

## Packages

${packages}

## Install

Start a TypeScript project, then install and run inside it with [safe-install](${safeInstall.home}), which installs with every lifecycle script off and asks before running any (with npm instead: \`npm install\`, \`npm run server\`, \`npm run client\`):

\`\`\`sh
${quickstartCommands()}
\`\`\`

Add the client to an existing app: \`safe-install add @accordsync/client\`.

Flutter:

${fence("flutter.install")}

PHP (Laravel; Symfony: \`composer require accordsync/symfony\`):

${fence("php.install")}

Python:

${fence("python.install")}

## Rules for AI agents

- Install JavaScript packages with safe-install (\`safe-install add <package>\`, \`safe-install install\`), never with npm, pnpm, yarn or bun directly. Its rules for agents: ${safeInstall.llms}
- Never approve install scripts yourself (no \`safe-install approve\`, \`--force\`, \`--yes\` or \`allowScripts\` edits). If a script is skipped, stop and tell the human the package and its scripts.
- Pick a merge rule for every field. Use \`conflict()\` for status, approvals, amounts and anything with money or legal weight; never \`lww()\` there.
- Do not set a device id: the client generates and stores one; a fixed id can get writes refused.
- Do not check the network before writing: writes are local and sync catches up.
- Per-platform prompts for coding agents: ${prompts}.

## Optional

- [Full docs as one file](${SITE}/llms-full.txt): every docs page above, prose and code.
- [crossben/accordsync](${repo.home}): the TypeScript packages, docs, test vectors and the conformance suite.
${languageRepos.map((r) => `- [crossben/${r.name}](${r.url})`).join("\n")}
- [Architecture decision records](${repo.planProof}): every design decision and why.
- [Conformance suite](${repo.home}/tree/main/conformance): black-box HTTP suite every Accord server must pass.
- [Merge rules and golden vectors](${repo.mergeRules})
- [CHANGELOG](${repo.changelog})
- [Home page (French)](${SITE}/fr/) and [docs in French](${SITE}/fr/docs/)
`;
}

function mergeTableMarkdown(): string {
  const { columns, rows } = en.merges.table;
  const head = `| ${columns.strategy} | ${columns.useFor} | ${columns.rule} | ${columns.example} |\n| --- | --- | --- | --- |`;
  const body = strategies
    .map(({ id }) => {
      const r = rows[id];
      return `| \`${id}\` | ${r.useFor} | ${r.rule} | ${r.before} → ${r.after} |`;
    })
    .join("\n");
  return `${head}\n${body}`;
}

export function llmsFullTxt(): string {
  const pages = docsPages.map((page) => {
    const copy = en.docs.pages[page.slug];
    const sections = page.sections.map((section) => {
      const s = copy.sections[section.key]!;
      const parts = [`## ${s.title}`, ...s.body];
      if (s.items) parts.push(s.items.map((i) => `- ${i}`).join("\n"));
      if ("mergeTable" in section && section.mergeTable) parts.push(mergeTableMarkdown());
      if ("snippets" in section) {
        for (const id of section.snippets as readonly DocSnippetId[]) {
          parts.push(`${fence(id)}\n\n(from ${docSnippet(id).source})`);
        }
      }
      return parts.join("\n\n");
    });
    return [
      `# ${copy.title}`,
      `URL: ${docsUrl(page.slug)} · Source: ${repo.blob}/${page.source}`,
      copy.intro,
      ...sections,
    ].join("\n\n");
  });
  return `# Accord docs (full text)

> ${en.meta.description}

Every docs page at ${docsUrl()} in one file, v${version.number}. Code blocks are read verbatim from the Accord repository at build time. Summary and links: ${SITE}/llms.txt

${pages.join("\n\n---\n\n")}
`;
}
