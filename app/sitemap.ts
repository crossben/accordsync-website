import type { MetadataRoute } from "next";
import { docsHref, docsSlugs } from "@/lib/docsPages";

export const dynamic = "force-static";

const SITE = "https://accord.benhattab.pro";

/** Each page in both languages, with its hreflang alternates. */
function pair(en: string, fr: string, priority: number): MetadataRoute.Sitemap {
  const alternates = { languages: { en: `${SITE}${en}`, fr: `${SITE}${fr}` } };
  return [
    {
      url: `${SITE}${en}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority,
      alternates,
    },
    {
      url: `${SITE}${fr}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: priority - 0.1,
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
