import { SITE } from "@/lib/docsPages";

// robots.txt: everything is public. A route (not app/robots.ts) so it can carry comments.
export const dynamic = "force-static";

export function GET() {
  const body = `# Accord: offline-first sync. Summary for language models: ${SITE}/llms.txt
# Full docs as one file: ${SITE}/llms-full.txt
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
