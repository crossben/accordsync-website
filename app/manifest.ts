import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Web app manifest: install metadata, theme colours and the icon set.
// The brand files are the committed proposal in public/brand/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accord — offline-first sync that stays correct when the network lies",
    short_name: "Accord",
    description:
      "Accord is an open-source, self-hosted offline-first sync engine in development: local-first writes, operations instead of overwrites, declared merge rules, and conflicts your app decides.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F3F5F1",
    theme_color: "#1D6B57",
    icons: [
      { src: "/brand/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/brand/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
