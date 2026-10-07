import { llmsFullTxt } from "@/lib/llms";

// /llms-full.txt: every English docs page (prose and verbatim snippets) as one Markdown document.
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
