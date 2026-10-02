"use client";

import { useEffect, useState } from "react";
import type { Content } from "@/content/types";
import { repo } from "@/content/facts";

function ThemeToggle({ labels }: { labels: Content["header"]["themeToggle"] }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !(dark ?? document.documentElement.dataset.theme === "dark");
    document.documentElement.dataset.theme = next ? "dark" : "light";
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("accord-theme", next ? "dark" : "light");
    } catch {
      /* private mode: theme just won't persist */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? labels.toLight : labels.toDark}
      title={dark ? labels.toLight : labels.toDark}
      className="grid size-9 place-items-center rounded-full border border-line text-ink transition-colors hover:border-accent hover:text-accent"
    >
      {dark === null ? (
        // First paint on the server: render a neutral dot; the real icon appears
        // right after hydration (which happens before the user can click).
        <span className="size-4 rounded-full border border-current" aria-hidden="true" />
      ) : dark ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}

function LanguageLink({ other }: { other: Content["otherLang"] }) {
  const [hash, setHash] = useState("");
  useEffect(() => {
    // Keep the current section when switching language (website.md section 3).
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return (
    <a
      href={other.href + hash}
      lang={other.href.startsWith("/fr") ? "fr" : "en"}
      className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
    >
      {other.label}
    </a>
  );
}

export default function Header({ content }: { content: Content }) {
  const nav = [
    ["#problem", content.header.nav.problem],
    ["#how", content.header.nav.how],
    ["#merges", content.header.nav.merges],
    ["#guarantees", content.header.nav.guarantees],
    ["#code", content.header.nav.code],
    ["#proof", content.header.nav.proof],
    ["#run", content.header.nav.run],
    ["#opensource", content.header.nav.openSource],
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <a
          href={content.lang === "en" ? "/" : "/fr/"}
          aria-label={content.header.homeAria}
          className="flex shrink-0 items-center"
        >
          {/* Proposed brand files (website.md section 2): they move to app/docs/assets/ once approved. */}
          <img
            src="/brand/logo.svg"
            alt=""
            width={128}
            height={24}
            className="h-6 w-auto dark:hidden"
          />
          <img
            src="/brand/logo-dark.svg"
            alt=""
            width={128}
            height={24}
            className="hidden h-6 w-auto dark:block"
          />
        </a>

        <nav
          aria-label={content.lang === "en" ? "Sections" : "Sections"}
          className="mx-auto hidden lg:block"
        >
          <ul className="flex items-center gap-0.5">
            {nav.map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="rounded-full px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <LanguageLink other={content.otherLang} />
          <ThemeToggle labels={content.header.themeToggle} />
          <a
            href={repo.home}
            className="grid size-9 place-items-center rounded-full border border-line text-ink transition-colors hover:border-accent hover:text-accent"
            aria-label="GitHub"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-[18px]" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
