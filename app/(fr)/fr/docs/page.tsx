import { fr as content } from "@/content/fr";
import { docsMetadata } from "@/lib/docsPages";
import { DocsIndex } from "@/components/docs/DocsPages";

export const metadata = docsMetadata(content, "", content.docs.index.description);

export default function Page() {
  return <DocsIndex content={content} />;
}
