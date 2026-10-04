import type { Metadata } from "next";
import { en as content } from "@/content/en";
import { type DocsSlug, docsMetadata, docsSlugs } from "@/lib/docsPages";
import { DocsPageView } from "@/components/docs/DocsPages";

type Params = { slug: DocsSlug };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return docsSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = content.docs.pages[slug];
  return docsMetadata(content, slug, page.title, page.description);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return <DocsPageView content={content} slug={slug} />;
}
