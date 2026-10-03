import type { Content } from "@/content/types";
import { repo } from "@/content/facts";
import { statusLine } from "@/lib/status";
import HeroSceneMount from "@/components/HeroSceneMount";

export default function Hero({ content }: { content: Content }) {
  const { hero } = content;
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 pt-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center md:px-6 md:pb-16 md:pt-20">
        <div className="relative z-10 max-w-xl">
          {/* Proposed wordmark (website.md section 2); the owner approves the brand files. */}
          <img
            src="/brand/logo.svg"
            alt="Accord"
            width={214}
            height={40}
            className="h-10 w-auto dark:hidden"
            fetchPriority="high"
          />
          <img
            src="/brand/logo-dark.svg"
            alt="Accord"
            width={214}
            height={40}
            className="hidden h-10 w-auto dark:block"
            fetchPriority="high"
          />
          <p className="mt-6 font-mono text-sm text-accent">{hero.kicker}</p>
          <h1 className="mt-2 text-4xl font-bold leading-[1.1] tracking-tight text-balance md:text-5xl">
            {hero.headline}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{hero.subline}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#how"
              className="rounded-full bg-accent px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 dark:text-[#0f161c]"
              // white on accent-light is 6.38:1; dark bg on accent-dark is 8.52:1 (README)
            >
              {hero.ctaHow}
            </a>
            <a
              href={repo.home}
              className="rounded-full border border-ink px-6 py-3 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {hero.ctaGithub}
            </a>
          </div>

          {/* Required status line (website.md section 4). */}
          <p className="mt-5 font-mono text-sm text-muted">
            {statusLine(hero.statusLine, content.lang)}
          </p>
        </div>

        {/* The scene is decorative: fixed-height container (no CLS), text stays the LCP. */}
        <div className="hero-scene-container relative h-[320px] sm:h-[380px] md:h-[440px]">
          <HeroSceneMount scene={hero.scene} />
          <p className="sr-only">{hero.scene.description}</p>
          {/* Visible caption: it is an illustration, never a live view (section 6). */}
          <p className="absolute bottom-0 right-0 text-xs text-muted">{hero.scene.caption}</p>
        </div>
      </div>
    </section>
  );
}
