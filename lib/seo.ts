// Structured data (JSON-LD, schema.org) for the home and docs pages. Every value comes from the
// facts sheet or the page copy: nothing here is a new claim.
import { licence, repo, version } from "@/content/facts";
import type { Content } from "@/content/types";
import { SITE, docsHref } from "@/lib/docsPages";

const author = { "@type": "Person", name: "Ben Hattab", url: "https://github.com/crossben" };

const inLanguage = (lang: Content["lang"]) => (lang === "fr" ? "fr-FR" : "en");
const homeUrl = (lang: Content["lang"]) => `${SITE}${lang === "fr" ? "/fr/" : "/"}`;

/** Accord itself, as source code and as a free developer application. */
function software(content: Content) {
  return {
    "@type": ["SoftwareSourceCode", "SoftwareApplication"],
    "@id": `${SITE}/#software`,
    name: "Accord",
    description: content.meta.description,
    url: `${SITE}/`,
    codeRepository: repo.home,
    // facts.clients: TypeScript, Dart/Flutter and Python clients; TypeScript, PHP, Python servers.
    programmingLanguage: ["TypeScript", "Dart", "PHP", "Python"],
    license: `https://spdx.org/licenses/${licence.accord}.html`,
    softwareVersion: version.number,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cross-platform",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author,
    keywords:
      "offline-first sync, local-first, sync engine, CRDT, conflict resolution, Flutter offline sync, React Native offline sync, Laravel sync server, Symfony, Django sync, FastAPI, PostgreSQL, self-hosted",
  };
}

export function homeJsonLd(content: Content) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        name: "Accord",
        url: homeUrl(content.lang),
        inLanguage: inLanguage(content.lang),
        description: content.meta.description,
        publisher: author,
      },
      software(content),
    ],
  };
}

/** A docs page (slug "" is the docs index): TechArticle + BreadcrumbList. */
export function docsJsonLd(content: Content, slug: string, title: string, description: string) {
  const url = `${SITE}${docsHref(content.lang, slug)}`;
  const crumbs = [
    { name: "Accord", item: homeUrl(content.lang) },
    { name: content.docs.navLabel, item: `${SITE}${docsHref(content.lang)}` },
    ...(slug ? [{ name: title, item: url }] : []),
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: title,
        description,
        url,
        mainEntityOfPage: url,
        inLanguage: inLanguage(content.lang),
        dateModified: version.date,
        author,
        publisher: author,
        image: `${SITE}/brand/social-preview.png`,
        about: { "@id": `${SITE}/#software` },
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE}/#website`,
          name: "Accord",
          url: `${SITE}/`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: c.item,
        })),
      },
      software(content),
    ],
  };
}

/** Serialised for a <script type="application/ld+json">; `<` escaped so it cannot close the tag. */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
