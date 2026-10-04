// Build-time reader for the docs pages' snippets: the verbatim fenced code block of an Accord file
// (the snapshot in accord/) that contains a marker. See scripts/doc-snippets.mjs for the list.
// Nothing here is retyped by hand.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DOC_SNIPPETS } from "../scripts/doc-snippets.mjs";

export type DocSnippetId = keyof typeof DOC_SNIPPETS;
export type DocSnippet = { code: string; lang: string; source: string };

const snapshotDir = () => resolve(process.cwd(), "accord");
const cache = new Map<string, string>();

function read(file: string): string {
  let text = cache.get(file);
  if (text === undefined) {
    try {
      text = readFileSync(join(snapshotDir(), file), "utf8");
    } catch (error) {
      throw new Error(
        `[docs] Cannot read ${file} in the Accord snapshot: run \`npm run sync:app\`.\n${String(error)}`,
      );
    }
    cache.set(file, text);
  }
  return text;
}

// Shiki language ids for the docs' fences.
const LANG: Record<string, string> = { sh: "bash", jsonc: "json", "": "text" };

/** Fenced blocks of a Markdown file, dedented when they sit inside a list item. */
function codeBlocks(markdown: string): { code: string; lang: string }[] {
  const blocks: { code: string; lang: string }[] = [];
  const re = /^( *)```([\w-]*)\n([\s\S]*?)\n\1```/gm;
  for (const m of markdown.matchAll(re)) {
    const indent = m[1].length;
    const code = m[3]
      .split("\n")
      .map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length)))
      .join("\n");
    blocks.push({ code, lang: LANG[m[2]] ?? m[2] });
  }
  return blocks;
}

/** The one code block containing the snippet's marker; anything else fails the build. */
export function docSnippet(id: DocSnippetId): DocSnippet {
  const { file, marker } = DOC_SNIPPETS[id];
  const matches = codeBlocks(read(file)).filter((b) => b.code.includes(marker));
  if (matches.length !== 1) {
    throw new Error(
      `[docs] Snippet "${id}": expected exactly one code block in ${file} containing ` +
        `${JSON.stringify(marker)}, found ${matches.length}. Update scripts/doc-snippets.mjs.`,
    );
  }
  return { ...matches[0]!, source: file };
}
