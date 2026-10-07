import { llmsTxt } from "@/lib/llms";

// /llms.txt (https://llmstxt.org): generated in lib/llms.ts from the facts sheet, the English copy
// and the docs snippets, and exported as a static file.
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
