import ExternalArrow from "@/components/ExternalArrow";
import { highlight } from "@/lib/shiki";
import { codeSnippets } from "@/lib/snippets";
import {
  ciRuns,
  guarantees,
  licence,
  loadTest,
  proofSources,
  quickstartOutput,
  proofs,
  repo,
  safeInstall,
  screenshot,
  strategies,
} from "@/content/facts";
import { features } from "@/content/features";
import { docsHref } from "@/lib/docsPages";
import type { Content } from "@/content/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Section from "@/components/Section";
import Reveal from "@/components/Reveal";
import PlannedBadge from "@/components/PlannedBadge";
import SyncTimeline from "@/components/SyncTimeline";
import MergeTable from "@/components/MergeTable";
import CodeTabs, { type CodeTab } from "@/components/CodeTabs";
import CodeBlock from "@/components/CodeBlock";
import PlaygroundMount from "@/components/playground/PlaygroundMount";
import Terminal from "@/components/Terminal";
import { homeJsonLd, jsonLdHtml } from "@/lib/seo";

function JsonLd({ content }: { content: Content }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(homeJsonLd(content)) }}
    />
  );
}

const isDesigned = (facts: readonly { tier: string }[]) => facts.some((f) => f.tier === "designed");

const linkClass =
  "font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent";

export default async function Page({ content }: { content: Content }) {
  // A section keeps its Planned badge only while one of its facts is still designed.
  const strategiesPlanned = isDesigned(strategies);
  const guaranteesPlanned = isDesigned(guarantees);
  const tabs: CodeTab[] = await Promise.all(
    (
      [
        ["schema", "typescript"],
        ["offline", "typescript"],
        ["conflict", "typescript"],
      ] as const
    ).map(async ([id, lang]) => ({
      id,
      label: content.code.tabLabels[id],
      lang,
      raw: codeSnippets[id],
      html: await highlight(codeSnippets[id], lang),
    })),
  );

  const quickstartBlocks = features.quickstart
    ? await Promise.all(
        content.quickstart.steps.map(async (step) => ({
          commands: step.commands,
          html: await highlight(step.commands.join("\n"), "bash"),
        })),
      )
    : [];

  return (
    <>
      <a
        href="#main"
        className="skip-link z-[100] rounded-md bg-surface px-3 py-2 text-sm font-medium text-ink shadow"
      >
        {content.header.skipToContent}
      </a>
      <Header content={content} />
      <main id="main">
        <Hero content={content} />

        {/* 2 — The problem */}
        <Section id="problem" title={content.problem.heading}>
          <Reveal className="grid gap-4 md:grid-cols-3" stagger>
            {content.problem.cards.map((card) => (
              <div key={card.title} className="rounded-xl border border-line bg-surface p-6">
                <h3 className="font-semibold leading-snug">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
              </div>
            ))}
          </Reveal>
        </Section>

        {/* 3 — How sync works */}
        <Section
          id="how"
          title={content.how.heading}
          badge={strategiesPlanned ? <PlannedBadge planned={content.how.planned} /> : null}
          intro={content.how.intro}
        >
          <SyncTimeline t={content.how.timeline} />
          <Reveal as="ol" className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3" stagger>
            {content.how.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-accent font-mono text-xs text-accent"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </Section>

        {/* 4 — Merge rules */}
        <Section
          id="merges"
          title={content.merges.heading}
          badge={strategiesPlanned ? <PlannedBadge planned={content.merges.planned} /> : null}
          intro={content.merges.intro}
        >
          <MergeTable content={content.merges} />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            {content.merges.note}{" "}
            <a
              href={repo.mergeRules}
              className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
            >
              docs/merge-rules.md <ExternalArrow />
            </a>
          </p>
        </Section>

        {/* 5 — What Accord guarantees (planned until tests land) */}
        <Section
          id="guarantees"
          title={content.guarantees.heading}
          badge={guaranteesPlanned ? <PlannedBadge planned={content.guarantees.planned} /> : null}
          intro={content.guarantees.intro}
        >
          <Reveal className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger>
            {guarantees.map(({ key, tier, source }) => {
              const item = content.guarantees.items[key];
              return (
                <div
                  key={key}
                  className="flex flex-col rounded-xl border border-line bg-surface p-6"
                >
                  <h3 className="font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    <span className="font-medium">{content.guarantees.whyLabel}</span>{" "}
                    <span className="text-muted">{item.why}</span>
                  </p>
                  <p className="mt-4">
                    {tier === "designed" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">
                        {content.guarantees.planned.label}
                      </span>
                    ) : (
                      <a href={source} className={`text-sm ${linkClass}`}>
                        {content.guarantees.testLink} <ExternalArrow />
                      </a>
                    )}
                  </p>
                </div>
              );
            })}
          </Reveal>
          <p className="mt-6 text-sm text-muted">
            <a
              href={repo.planProof}
              className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
            >
              {content.guarantees.sourceLink.label} <ExternalArrow />
            </a>
          </p>
        </Section>

        {/* 6 — Your code */}
        <Section id="code" title={content.code.heading} intro={content.code.intro}>
          {/* The "API preview" label only shows while the snippets are NOT
              type-checked against the app/ packages (features.ts). */}
          {features.snippetsCheckedAgainstApp ? null : (
            <p className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs font-medium text-muted">
                {content.code.previewLabel}
              </span>
            </p>
          )}
          <CodeTabs tabs={tabs} labels={content.code} />
          <p className="mt-4 text-sm">
            <a href={docsHref(content.lang, "client")} className={linkClass}>
              {content.docs.homeLinks.code} →
            </a>
          </p>
          {features.screenshots ? (
            <figure className="mt-12">
              <img
                src={screenshot.src}
                width={screenshot.width}
                height={screenshot.height}
                alt={content.code.screenshot.alt}
                loading="lazy"
                decoding="async"
                className="h-auto w-full max-w-3xl rounded-xl border border-line"
              />
              <figcaption className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                {content.code.screenshot.caption}{" "}
                <a href={screenshot.example} className={linkClass}>
                  {content.code.screenshot.link} <ExternalArrow />
                </a>
              </figcaption>
            </figure>
          ) : null}
        </Section>

        {/* 7 — Playground: the published @accordsync/core and simulator, loaded when visible. */}
        {features.playground ? (
          <Section
            id="playground"
            title={content.playground.heading}
            intro={content.playground.intro}
          >
            <noscript>
              <p className="text-sm text-muted">{content.playground.noscript}</p>
            </noscript>
            <PlaygroundMount t={content.playground} />
          </Section>
        ) : null}

        {/* 8 — Proof */}
        <Section id="proof" title={content.proof.heading} intro={content.proof.intro}>
          <Reveal className="grid gap-4 md:grid-cols-3" stagger>
            {proofs.map((key) => {
              const item = content.proof.items[key];
              return (
                <div
                  key={key}
                  className="flex flex-col rounded-xl border border-line bg-surface p-6"
                >
                  <h3 className="font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  <p className="mt-auto pt-4">
                    <a href={proofSources[key]} className={`text-sm ${linkClass}`}>
                      {content.proof.testLink} <ExternalArrow />
                    </a>
                  </p>
                </div>
              );
            })}
          </Reveal>
          {features.proofNumbers ? (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
              {content.proof.ciLine
                .replace("{simulations}", ciRuns.simulations.toLocaleString(content.lang))
                .replace("{propertyCases}", ciRuns.propertyCases.toLocaleString(content.lang))}
            </p>
          ) : null}
          {features.loadTest ? (
            <div className="mt-12">
              <h3 className="text-xl font-semibold">{content.proof.load.heading}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {content.proof.load.intro}
              </p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[28rem] border-collapse bg-surface text-sm">
                  <thead>
                    <tr className="border-b border-line text-right">
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {content.proof.load.columns.devices}
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {content.proof.load.columns.workers}
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {content.proof.load.columns.ops}
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {content.proof.load.columns.push}
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        {content.proof.load.columns.pull}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {loadTest.rows.map((r) => (
                      <tr
                        key={r.devices}
                        className="border-b border-line text-right last:border-b-0"
                      >
                        <th scope="row" className="px-4 py-3 font-medium">
                          {r.devices}
                        </th>
                        <td className="px-4 py-3">{r.workers}</td>
                        <td className="px-4 py-3">{r.opsPerSec.toLocaleString(content.lang)}</td>
                        <td className="px-4 py-3">{r.pushP95.toLocaleString(content.lang)} ms</td>
                        <td className="px-4 py-3">{r.pullP95} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                <span className="font-medium text-ink">{content.proof.load.hardwareLabel}</span>{" "}
                {loadTest.hardware}. {content.proof.load.caveat}{" "}
                <a href={loadTest.source} className={linkClass}>
                  {content.proof.load.link} <ExternalArrow />
                </a>
              </p>
            </div>
          ) : null}
        </Section>

        {/* 9 — Run it yourself (features.quickstart; section 5.9) */}
        {features.quickstart ? (
          <Section id="run" title={content.quickstart.heading} intro={content.quickstart.intro}>
            <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
              <div className="min-w-0 space-y-8">
                {content.quickstart.steps.map((step, i) => (
                  <div key={step.title}>
                    <h3 className="font-semibold">
                      <span className="mr-2 font-mono text-sm text-accent">{i + 1}</span>
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                    <div className="mt-3">
                      <CodeBlock
                        code={step.commands.join("\n")}
                        lang="bash"
                        labels={content.code}
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-line p-4">
                  <h3 className="font-semibold">{content.quickstart.safeInstall.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {content.quickstart.safeInstall.body}
                  </p>
                  <p className="mt-2 text-sm">
                    <a href={safeInstall.home} className={linkClass}>
                      {content.quickstart.safeInstall.link}
                    </a>
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-muted">{content.quickstart.note}</p>
                <p className="text-sm">
                  <a href={docsHref(content.lang, "quickstart")} className={linkClass}>
                    {content.docs.homeLinks.run} →
                  </a>
                </p>
              </div>
              <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
                <Terminal
                  label={content.quickstart.terminalLabel}
                  commands={content.quickstart.steps.flatMap((s) => s.commands)}
                  output={quickstartOutput}
                />
                <p className="mt-2 text-sm text-muted">{content.quickstart.terminalNote}</p>
              </div>
            </div>
          </Section>
        ) : null}

        {/* 10 — What Accord is not (straight, no jokes — section 5.10) */}
        <Section id="not" title={content.not.heading} intro={content.not.intro}>
          <Reveal className="grid gap-4 md:grid-cols-3" stagger>
            {Object.entries(content.not.items).map(([key, item]) => (
              <div key={key} className="rounded-xl border border-line bg-surface p-6">
                <h3 className="font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </Reveal>
        </Section>

        {/* 11 — Open source */}
        <Section id="opensource" title={content.openSource.heading}>
          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold">{content.openSource.licence.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {content.openSource.licence.body}
              </p>
              {features.repoLinks.license ? (
                <a
                  href={repo.license}
                  className="mt-3 inline-block text-sm font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
                >
                  LICENSE <ExternalArrow />
                </a>
              ) : null}
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold">{content.openSource.contribute.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {content.openSource.contribute.body}
              </p>
              {features.repoLinks.contributing ? (
                <a
                  href={repo.contributing}
                  className="mt-3 inline-block text-sm font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
                >
                  CONTRIBUTING.md <ExternalArrow />
                </a>
              ) : null}
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold">{content.openSource.security.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {content.openSource.security.body}
              </p>
              {features.repoLinks.security ? (
                <a
                  href={repo.security}
                  className="mt-3 inline-block text-sm font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
                >
                  SECURITY.md <ExternalArrow />
                </a>
              ) : null}
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-semibold">{content.openSource.roadmap.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {content.openSource.roadmap.body}
              </p>
            </div>
          </Reveal>
          <p className="mt-6 text-sm text-muted">
            {content.openSource.licence.title}: {licence.accord}
            {licence.confirmed ? "" : ` (${content.guarantees.planned.label})`}
          </p>
        </Section>
      </main>
      <Footer content={content} />
      <JsonLd content={content} />
    </>
  );
}
