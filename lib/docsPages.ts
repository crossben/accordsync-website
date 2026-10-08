// The structure of the docs pages, shared by both languages: the pages in sidebar order, their
// sections, and which verbatim snippets each section shows (scripts/doc-snippets.mjs). The prose
// around them comes from content/{en,fr}.ts (`docs`).
import type { Metadata } from "next";
import { repo } from "@/content/facts";
import type { Content } from "@/content/types";
import type { DocSnippetId } from "@/lib/docs";

export const SITE = "https://accord.benhattab.pro";

export type DocsSection = {
  key: string;
  snippets?: DocSnippetId[];
  /** Render the home page's merge-rules table in this section. */
  mergeTable?: boolean;
};

export type DocsPage = { slug: string; source: string; sections: DocsSection[] };

export const docsPages = [
  {
    slug: "quickstart",
    source: "packages/create-accord/template/README.md",
    sections: [
      { key: "create", snippets: ["quickstart.create"] },
      { key: "run", snippets: ["quickstart.run"] },
      { key: "files" },
    ],
  },
  {
    slug: "schema",
    source: "docs/merge-rules.md",
    sections: [
      { key: "strategies", mergeTable: true },
      { key: "define", snippets: ["schema.define"] },
      { key: "conflicts" },
    ],
  },
  {
    slug: "client",
    source: "docs/client.md",
    sections: [
      { key: "open", snippets: ["client.open"] },
      { key: "conflicts", snippets: ["client.conflicts"] },
      { key: "events", snippets: ["client.events"] },
      { key: "storage" },
      { key: "agent", snippets: ["client.agent"] },
    ],
  },
  {
    slug: "react",
    source: "packages/react/README.md",
    sections: [
      { key: "hooks", snippets: ["react.hooks"] },
      { key: "rendering" },
      { key: "agent", snippets: ["react.agent"] },
    ],
  },
  {
    slug: "react-native",
    source: "docs/react-native.md",
    sections: [
      { key: "install", snippets: ["rn.install", "rn.polyfill"] },
      { key: "open", snippets: ["rn.open"] },
      { key: "lifecycle", snippets: ["rn.lifecycle"] },
      { key: "agent", snippets: ["rn.agent"] },
    ],
  },
  {
    slug: "flutter",
    source: "docs/flutter.md",
    sections: [
      { key: "install", snippets: ["flutter.install"] },
      { key: "open", snippets: ["flutter.open"] },
      { key: "lifecycle", snippets: ["flutter.lifecycle"] },
      { key: "widgets", snippets: ["flutter.widgets"] },
      { key: "parity" },
      { key: "agent", snippets: ["flutter.agent"] },
    ],
  },
  {
    slug: "php",
    source: "docs/php.md",
    sections: [
      { key: "install", snippets: ["php.install"] },
      { key: "define", snippets: ["php.define"] },
      { key: "frameworks" },
      { key: "migrate", snippets: ["php.migrate"] },
      { key: "parity" },
    ],
  },
  {
    slug: "python",
    source: "docs/python.md",
    sections: [
      { key: "install", snippets: ["python.install"] },
      { key: "open", snippets: ["python.open"] },
      { key: "conflicts", snippets: ["python.conflicts"] },
      { key: "server", snippets: ["python.fastapi"] },
      { key: "django", snippets: ["python.django"] },
      { key: "migrate", snippets: ["python.migrate"] },
      { key: "parity" },
      { key: "agent", snippets: ["python.agent"] },
    ],
  },
  {
    slug: "java",
    source: "docs/java.md",
    sections: [
      { key: "install", snippets: ["java.install", "java.gradle"] },
      { key: "open", snippets: ["java.open"] },
      { key: "conflicts", snippets: ["java.conflicts"] },
      { key: "server", snippets: ["java.server"] },
      { key: "migrate", snippets: ["java.migrate"] },
      { key: "parity" },
      { key: "agent", snippets: ["java.agent"] },
    ],
  },
  {
    slug: "server",
    source: "README.md",
    sections: [
      { key: "configure", snippets: ["server.define"] },
      { key: "env" },
      { key: "scaling" },
    ],
  },
  {
    slug: "scopes",
    source: "docs/scopes.md",
    sections: [
      { key: "how", snippets: ["scopes.basics"] },
      { key: "patterns", snippets: ["scopes.supervisor", "scopes.tenant", "scopes.shared"] },
      { key: "rules" },
    ],
  },
  {
    slug: "protocol",
    source: "docs/protocol.md",
    sections: [
      { key: "push", snippets: ["protocol.push"] },
      { key: "pull", snippets: ["protocol.pull"] },
      { key: "resync", snippets: ["protocol.resync"] },
      { key: "errors" },
    ],
  },
  {
    slug: "security",
    source: "docs/security.md",
    sections: [{ key: "enforced" }, { key: "deploy" }],
  },
] as const satisfies readonly DocsPage[];

export type DocsSlug = (typeof docsPages)[number]["slug"];
export const docsSlugs = docsPages.map((p) => p.slug);

/** "" is the index. */
export function docsHref(lang: Content["lang"], slug = ""): string {
  return `${lang === "en" ? "" : "/fr"}/docs/${slug ? `${slug}/` : ""}`;
}

export function sourceHref(file: string): string {
  return `${repo.blob}/${file}`;
}

/** Per-page metadata with canonical and hreflang alternates for both languages. */
export function docsMetadata(content: Content, slug: DocsSlug | "", description: string): Metadata {
  const url = docsHref(content.lang, slug);
  const fullTitle = `${content.docs.metaTitles[slug || "index"]} — Accord docs`;
  const ogAlt =
    content.lang === "en"
      ? "Accord — offline-first sync that stays correct when the network lies."
      : "Accord — la synchronisation offline-first qui reste correcte quand le réseau ment.";
  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: docsHref("en", slug),
        fr: docsHref("fr", slug),
        "x-default": docsHref("en", slug),
      },
      types: { "text/plain": "/llms.txt" },
    },
    openGraph: {
      type: "article",
      siteName: "Accord",
      title: fullTitle,
      description,
      url,
      locale: content.lang === "en" ? "en" : "fr_FR",
      alternateLocale: content.lang === "en" ? ["fr_FR"] : ["en"],
      images: [{ url: "/brand/social-preview.png", width: 1200, height: 630, alt: ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/brand/social-preview.png"],
    },
  };
}
