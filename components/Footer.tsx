import type { Content } from "@/content/types";
import { repo, safeInstall } from "@/content/facts";
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

  links.push({ label: content.footer.linkLabels.safeInstall, href: safeInstall.home });
  links.push({ label: content.footer.linkLabels.llms, href: "/llms.txt" });

  return (
    <footer className="border-t border-line">
      {/* Next project: the three open-source projects link to each other in a ring. */}
      <div className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <a
          href="https://safe-install.benhattab.pro"
          className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border border-line px-5 py-4 transition-colors hover:border-accent"
        >
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            {content.lang === "fr" ? "Projet suivant" : "Next project"}
          </span>
          <span className="flex-1 text-sm">
            <span className="font-medium transition-colors group-hover:text-accent">safe-install</span>{" "}
            <span className="text-muted">— {content.lang === "fr" ? "installer des dépendances JavaScript sans laisser n'importe quel script s'exécuter" : "install JavaScript dependencies without letting any script run"}</span>
          </span>
          <span aria-hidden="true" className="text-muted transition-colors group-hover:text-accent">→</span>
        </a>
      </div>

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
