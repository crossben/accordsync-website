// The "Your code" snippets (website.md section 5.6) live as real TypeScript files in
// content/snippets/ so that, once app/packages/core and app/packages/client
// export the API, `npm run check:snippets` type-checks them in CI. They are
// read here at build time (server component) and highlighted with Shiki.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (name: string) =>
  readFileSync(join(process.cwd(), "content", "snippets", name), "utf8");

export const codeSnippets = {
  schema: read("schema.ts"),
  offline: read("offline-write.ts"),
  conflict: read("resolve-conflict.ts"),
} as const;
