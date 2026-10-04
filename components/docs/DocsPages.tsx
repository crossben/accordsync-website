// The developer docs (/docs/… and /fr/docs/…). Static, server-rendered, no animation: the docs are
// for reading. Every code block is read verbatim from the Accord snapshot (lib/docs.ts); prose comes
// from content/{en,fr}.ts (`docs`); the page structure from lib/docsPages.ts.
import { Fragment, type ReactNode } from "react";
import type { Content } from "@/content/types";
import { version } from "@/content/facts";
import { docSnippet, type DocSnippetId } from "@/lib/docs";
import { type DocsSlug, docsHref, docsPages, sourceHref } from "@/lib/docsPages";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CodeBlock from "@/components/CodeBlock";
import ExternalArrow from "@/components/ExternalArrow";
import MergeTable from "@/components/MergeTable";

const linkClass =
  "font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent";

/** Prose with `inline code` (backticks), the only markup the docs copy uses. */
function Text({ children }: { children: string }) {
  const parts = children.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Sidebar({ content, slug }: { content: Content; slug: string }) {
  const { docs } = content;
  return (
    <nav aria-label={docs.navLabel} className="lg:sticky lg:top-24">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">
        <a
          href={docsHref(content.lang)}
          aria-current={slug === "" ? "page" : undefined}
          className="hover:text-ink"
        >
          {docs.navLabel}
        </a>
      </p>
      <ul className="mt-3 space-y-0.5">
        {docsPages.map((page) => (
          <li key={page.slug}>
            <a
              href={docsHref(content.lang, page.slug)}
              aria-current={slug === page.slug ? "page" : undefined}
              className="block rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {docs.pages[page.slug].title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DocsShell({
  content,
  slug,
  title,
  intro,
  children,
}: {
  content: Content;
  slug: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const other = content.lang === "en" ? "fr" : "en";
  return (
    <>
      <a
        href="#main"
        className="skip-link z-[100] rounded-md bg-surface px-3 py-2 text-sm font-medium text-ink shadow"
      >
        {content.header.skipToContent}
      </a>
      <Header content={content} onHome={false} otherHref={docsHref(other, slug)} current="docs" />
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-10 md:px-6 md:py-14 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-b border-line pb-6 lg:border-b-0 lg:pb-0">
          <Sidebar content={content} slug={slug} />
        </aside>
        <main id="main" className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">{title}</h1>
          <div className="mt-4 max-w-3xl leading-relaxed text-muted">{intro}</div>
          <div className="mt-10 max-w-3xl space-y-12">{children}</div>
        </main>
      </div>
      <Footer content={content} />
    </>
  );
}

/** A repository snippet, verbatim, with the file it comes from. */
async function Snippet({ content, id }: { content: Content; id: DocSnippetId }) {
  const snippet = docSnippet(id);
  return (
    <figure className="mt-4">
      <CodeBlock code={snippet.code} lang={snippet.lang} labels={content.code} />
      <figcaption className="mt-2 text-xs text-muted">
        {content.docs.fromLabel}{" "}
        <a href={sourceHref(snippet.source)} className={linkClass}>
          {snippet.source} <ExternalArrow />
        </a>
      </figcaption>
    </figure>
  );
}

export function DocsIndex({ content }: { content: Content }) {
  const { docs } = content;
  return (
    <DocsShell
      content={content}
      slug=""
      title={docs.index.title}
      intro={
        <>
          <p>{docs.index.intro}</p>
          {docs.index.note ? <p className="mt-3 text-sm">{docs.index.note}</p> : null}
        </>
      }
    >
      <section>
        <p className="font-medium">{docs.index.install}</p>
        <Snippet content={content} id="quickstart.create" />
        <p className="mt-2 font-mono text-xs text-muted">v{version.number}</p>
      </section>
      <ul className="grid gap-4 sm:grid-cols-2">
        {docsPages.map((page) => {
          const p = docs.pages[page.slug];
          return (
            <li key={page.slug}>
              <a
                href={docsHref(content.lang, page.slug)}
                className="block h-full rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent"
              >
                <span className="font-semibold">{p.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {p.description}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </DocsShell>
  );
}

export function DocsPageView({ content, slug }: { content: Content; slug: DocsSlug }) {
  const page = docsPages.find((p) => p.slug === slug)!;
  const copy = content.docs.pages[slug];
  return (
    <DocsShell content={content} slug={slug} title={copy.title} intro={<Text>{copy.intro}</Text>}>
      {page.sections.map((section) => {
        const s = copy.sections[section.key];
        if (!s) throw new Error(`[docs] ${content.lang}: no copy for ${slug}#${section.key}`);
        return (
          <section key={section.key} aria-labelledby={section.key}>
            <h2 id={section.key} className="scroll-mt-24 text-2xl font-bold tracking-tight">
              <a href={`#${section.key}`} className="hover:text-accent">
                {s.title}
              </a>
            </h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 leading-relaxed">
                <Text>{p}</Text>
              </p>
            ))}
            {s.items ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
                {s.items.map((item) => (
                  <li key={item}>
                    <Text>{item}</Text>
                  </li>
                ))}
              </ul>
            ) : null}
            {"mergeTable" in section && section.mergeTable ? (
              <div className="mt-4">
                <MergeTable content={content.merges} />
              </div>
            ) : null}
            {"snippets" in section
              ? section.snippets.map((id) => <Snippet key={id} content={content} id={id} />)
              : null}
          </section>
        );
      })}
      <p className="text-sm text-muted">
        {content.docs.sourceLabel}:{" "}
        <a href={sourceHref(page.source)} className={linkClass}>
          {page.source} <ExternalArrow />
        </a>
      </p>
    </DocsShell>
  );
}
