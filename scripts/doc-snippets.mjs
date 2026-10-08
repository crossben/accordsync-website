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
  "quickstart.run": {
    file: "packages/create-accord/template/README.md",
    marker: "safe-install run client",
  },

  // Schema and merge rules
  "schema.define": { file: "docs/merge-rules.md", marker: "const schema = defineSchema({" },

  // Client
  "client.open": { file: "docs/client.md", marker: "const accord = await AccordClient.open({" },
  "client.conflicts": { file: "docs/client.md", marker: "for (const c of accord.conflicts())" },
  "client.events": { file: "docs/client.md", marker: "accord.on('refused'" },
  "client.agent": {
    file: "docs/client.md",
    marker: "Integrate Accord (@accordsync/client 0.3.x) into this web app.",
  },

  // React
  "react.hooks": { file: "packages/react/README.md", marker: "<AccordProvider client={accord}>" },
  "react.agent": {
    file: "packages/react/README.md",
    marker: "Integrate Accord (@accordsync/react 0.3.x) into this React app.",
  },

  // React Native
  "rn.install": {
    file: "docs/react-native.md",
    marker: "safe-install add @accordsync/client @accordsync/react",
  },
  "rn.polyfill": {
    file: "docs/react-native.md",
    marker: "import 'react-native-get-random-values';",
  },
  "rn.open": { file: "docs/react-native.md", marker: "export async function openAccord(" },
  "rn.lifecycle": { file: "docs/react-native.md", marker: "export function useAccordLifecycle(" },
  "rn.agent": {
    file: "docs/react-native.md",
    marker: "Integrate Accord (@accordsync/client 0.3.x) into this React Native app.",
  },

  // Flutter
  "flutter.install": {
    file: "docs/flutter.md",
    marker: "flutter pub add accordsync_flutter drift_flutter",
  },
  "flutter.open": { file: "docs/flutter.md", marker: "Future<AccordClient> openAccord(" },
  "flutter.lifecycle": { file: "docs/flutter.md", marker: "child: AccordLifecycle(" },
  "flutter.widgets": { file: "docs/flutter.md", marker: "record: 'dossier:91'," },
  "flutter.agent": {
    file: "docs/flutter.md",
    marker: "Integrate Accord (accordsync_flutter 0.3.x) into this Flutter app.",
  },

  // PHP
  "php.install": { file: "docs/php.md", marker: "php artisan vendor:publish --tag=accord-config" },
  "php.define": { file: "docs/php.md", marker: "final class Definition" },
  "php.migrate": { file: "docs/php.md", marker: "php artisan accord:migrate" },

  // Python
  "python.install": { file: "docs/python.md", marker: "pip install accordsync-fastapi uvicorn" },
  "python.open": { file: "docs/python.md", marker: "accord = AccordClient.open(" },
  "python.conflicts": { file: "docs/python.md", marker: "for c in accord.conflicts():" },
  "python.agent": {
    file: "docs/python.md",
    marker: "Integrate the Accord client (accordsync 0.3.x) into this Python program.",
  },
  "python.fastapi": { file: "docs/python.md", marker: "app.include_router(accord_router(" },
  "python.django": { file: "docs/python.md", marker: '"accordsync_django"]' },
  "python.migrate": { file: "docs/python.md", marker: "python manage.py accord_migrate" },

  // Java
  "java.install": {
    file: "docs/java.md",
    marker: "<artifactId>accordsync-spring-boot-starter</artifactId>",
  },
  "java.gradle": {
    file: "docs/java.md",
    marker: 'implementation("io.github.crossben:accordsync-client:0.3.1")',
  },
  "java.open": {
    file: "docs/java.md",
    marker: "AccordClient accord = AccordClient.open(AccordClient.options()",
  },
  "java.conflicts": { file: "docs/java.md", marker: "for (ConflictInfo c : accord.conflicts())" },
  "java.server": { file: "docs/java.md", marker: "public ServerDefinition accordDefinition()" },
  "java.migrate": { file: "docs/java.md", marker: "accord.migrate-on-startup=true" },
  "java.agent": {
    file: "docs/java.md",
    marker:
      "Integrate the Accord client (io.github.crossben:accordsync-client 0.3.x) into this Java program.",
  },

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
  "docs/flutter.md",
  "docs/php.md",
  "docs/python.md",
  "docs/java.md",
  "README.md",
  "docs/scopes.md",
  "docs/protocol.md",
  "docs/security.md",
];
