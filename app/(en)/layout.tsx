import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { themeScript } from "@/components/theme-script";
import { en } from "@/content/en";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Provisional canonical domain (website.md section 11 — the owner picks the final one;
// the plan suggests accord.benhattab.pro). Update here, in sitemap.ts, in
// robots.ts and scripts/check-links.mjs together.
const SITE = "https://accord.benhattab.pro";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0F161C" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: en.meta.title,
  description: en.meta.description,
  applicationName: "Accord",
  authors: [{ name: "Ben Hattab", url: "https://github.com/crossben" }],
  creator: "Ben Hattab",
  publisher: "Ben Hattab",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
    languages: { en: "/", fr: "/fr/", "x-default": "/" },
    types: { "text/plain": "/llms.txt" },
  },
  robots: { index: true, follow: true },
  keywords: [
    "offline-first sync",
    "local-first",
    "sync engine",
    "CRDT",
    "conflict resolution",
    "Flutter offline sync",
    "React Native offline sync",
    "Laravel sync server",
    "Django sync",
    "PostgreSQL",
  ],
  openGraph: {
    type: "website",
    siteName: "Accord",
    title: en.meta.title,
    description: en.meta.description,
    url: "/",
    locale: "en",
    alternateLocale: ["fr_FR"],
    images: [
      {
        url: "/brand/social-preview.png",
        width: 1200,
        height: 630,
        alt: "Accord — offline-first sync that stays correct when the network lies.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: en.meta.title,
    description: en.meta.description,
    images: ["/brand/social-preview.png"],
  },
  icons: {
    icon: [
      { url: "/brand/icon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/apple-icon.png",
  },
};

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
