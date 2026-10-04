// Every code snippet on the docs pages (/docs/…), and where it comes from in the Accord repository.
//
// Snippets are never retyped: lib/docs.ts reads the fenced code block of `file` (in the committed
// snapshot accord/) that contains `marker`. Exactly one block must match, or the build fails.
// check-facts.mjs also requires every marker, so a doc change in the repository fails the website
// build until the docs pages follow (docs.md section 1).
//
// Plain JavaScript: the Node scripts and the Next build both import it.

export const DOC_SNIPPETS = {
  // Quick start
  "quickstart.create": {
    file: "packages/create-accord/README.md",
    marker: "npm create accord my-app",
  },
  "quickstart.run": { file: "packages/create-accord/template/README.md", marker: "npm run client" },

  // Schema and merge rules
  "schema.define": { file: "docs/merge-rules.md", marker: "const schema = defineSchema({" },

  // Client
  "client.open": { file: "docs/client.md", marker: "const accord = await AccordClient.open({" },
  "client.conflicts": { file: "docs/client.md", marker: "for (const c of accord.conflicts())" },
  "client.events": { file: "docs/client.md", marker: "accord.on('refused'" },

  // React
  "react.hooks": { file: "packages/react/README.md", marker: "<AccordProvider client={accord}>" },

  // React Native
  "rn.install": {
    file: "docs/react-native.md",
    marker: "npm install @accordsync/client @accordsync/react",
  },
  "rn.polyfill": {
    file: "docs/react-native.md",
    marker: "import 'react-native-get-random-values';",
  },
  "rn.open": { file: "docs/react-native.md", marker: "export async function openAccord(" },
  "rn.lifecycle": { file: "docs/react-native.md", marker: "export function useAccordLifecycle(" },

  // Server
  "server.define": { file: "README.md", marker: "export default defineServer({" },

  // Scope rules
  "scopes.basics": { file: "docs/scopes.md", marker: "scopes: { dossier: (record) =>" },
  "scopes.supervisor": {
    file: "docs/scopes.md",
    marker: "write: [`agent:${c.sub}`, ...(c.role === 'supervisor' ? zones : [])],",
  },
  "scopes.tenant": {
    file: "docs/scopes.md",
    marker: "scopes: { invoice: (r) => key('org', r.fields.org) },",
  },
  "scopes.shared": {
    file: "docs/scopes.md",
    marker: "scopes: { list: (r) => list(r.fields.members).map((m) => `member:${m}`) },",
  },

  // Sync protocol
  "protocol.push": { file: "docs/protocol.md", marker: '"op_id": "dev-7f3a:1042"' },
  "protocol.pull": { file: "docs/protocol.md", marker: '"has_more": true' },
  "protocol.resync": { file: "docs/protocol.md", marker: '"resync_required": true' },
};

/** The Accord files each docs page cites as its source (check-facts requires them). */
export const DOC_SOURCES = [
  "packages/create-accord/README.md",
  "packages/create-accord/template/README.md",
  "docs/merge-rules.md",
  "docs/client.md",
  "packages/react/README.md",
  "docs/react-native.md",
  "README.md",
  "docs/scopes.md",
  "docs/protocol.md",
  "docs/security.md",
];
