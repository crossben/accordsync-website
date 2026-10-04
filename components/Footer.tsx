import type { Content } from "@/content/types";
import { repo } from "@/content/facts";
import { statusLine } from "@/lib/status";
import { features } from "@/content/features";
import Mark from "@/components/Mark";

export default function Footer({ content }: { content: Content }) {
  const links: { label: string; href: string }[] = [
    { label: content.footer.linkLabels.github, href: repo.home },
  ];
  links.push({
    label: content.footer.linkLabels.docs,
    href: content.lang === "en" ? "/docs/" : "/fr/docs/",
  });
  if (features.repoLinks.changelog) {
    links.push({ label: content.footer.linkLabels.changelog, href: repo.changelog });
  }
  if (features.repoLinks.license) {
    links.push({ label: content.footer.linkLabels.license, href: repo.license });
  }

  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_auto] md:px-6">
        <div>
          <Mark className="h-8 w-11 text-accent" />
          <p className="mt-4 max-w-sm text-sm text-muted">{content.footer.tagline}</p>
          {/* The required status line (website.md section 4): version and date from facts.ts. */}
          <p className="mt-2 font-mono text-xs text-muted">
            {statusLine(content.footer.statusLine, content.lang)}
          </p>
        </div>
        <nav aria-label={content.lang === "en" ? "Footer" : "Pied de page"}>
          <ul className="flex flex-wrap items-start gap-x-6 gap-y-2 text-sm md:justify-end">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="underline decoration-line underline-offset-4 transition-colors hover:text-accent"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted md:text-right">{content.footer.copyright}</p>
        </nav>
      </div>
    </footer>
  );
}
