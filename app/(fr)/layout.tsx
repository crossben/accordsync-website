import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { themeScript } from "@/components/theme-script";
import { fr } from "@/content/fr";

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

// Provisional canonical domain — see app/(en)/layout.tsx.
const SITE = "https://accord.benhattab.pro";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0F161C" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: fr.meta.title,
  description: fr.meta.description,
  applicationName: "Accord",
  authors: [{ name: "Ben Hattab", url: "https://github.com/crossben" }],
  creator: "Ben Hattab",
  publisher: "Ben Hattab",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/fr/",
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
    title: fr.meta.title,
    description: fr.meta.description,
    url: "/fr/",
    locale: "fr_FR",
    alternateLocale: ["en"],
    images: [
      {
        url: "/brand/social-preview.png",
        width: 1200,
        height: 630,
        alt: "Accord — la synchronisation offline-first qui reste correcte quand le réseau ment.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: fr.meta.title,
    description: fr.meta.description,
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

export default function FrenchLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
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
