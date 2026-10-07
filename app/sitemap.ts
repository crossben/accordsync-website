import type { MetadataRoute } from "next";
import { version } from "@/content/facts";
import { SITE, docsHref, docsSlugs } from "@/lib/docsPages";

export const dynamic = "force-static";

// The content changes with releases: lastmod is the latest release date (facts.version).
const lastModified = new Date(`${version.date}T00:00:00Z`);

/** Each page in both languages, with its hreflang alternates (en, fr, x-default). */
function pair(en: string, fr: string, priority: number): MetadataRoute.Sitemap {
  const alternates = {
    languages: { en: `${SITE}${en}`, fr: `${SITE}${fr}`, "x-default": `${SITE}${en}` },
  };
  return [
    { url: `${SITE}${en}`, lastModified, changeFrequency: "monthly", priority, alternates },
    {
      url: `${SITE}${fr}`,
      lastModified,
      changeFrequency: "monthly",
      priority: Math.round((priority - 0.1) * 10) / 10,
      alternates,
    },
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...pair("/", "/fr/", 1),
    ...pair(docsHref("en"), docsHref("fr"), 0.9),
    ...docsSlugs.flatMap((slug) => pair(docsHref("en", slug), docsHref("fr", slug), 0.8)),
  ];
}
