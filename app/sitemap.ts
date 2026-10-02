import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = "https://accord.benhattab.pro";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
      alternates: {
        languages: {
          en: `${SITE}/`,
          fr: `${SITE}/fr/`,
        },
      },
    },
    {
      url: `${SITE}/fr/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
      alternates: {
        languages: {
          en: `${SITE}/`,
          fr: `${SITE}/fr/`,
        },
      },
    },
  ];
}
