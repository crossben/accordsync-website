# Accord website

The one-page site for [Accord](https://github.com/crossben/accordsync), the
offline-first sync engine — English at `/`, French at `/fr/`. Built to
[`../website.md`](../website.md); that file is the spec, this README is the
handover notes.

**The one rule** (website.md section 0): no claim the repository doesn't back up. Every
factual sentence comes from [`content/facts.ts`](content/facts.ts), which cites
its source, and `scripts/check-facts.mjs` re-reads those sources on every build
and fails when a claim is no longer backed. The banned-claims list (section 0) is
enforced on the copy itself in the same script. Facts carry a tier: `designed`
facts are written as intent and carry a **Planned** badge; `built` facts are
backed by code and a passing test in `app/` and may use the present tense.

## Develop

Requires Node ≥ 22 (`.nvmrc` pins 24). The Accord sources the site reads —
plan.md, README, CHANGELOG, LICENSE, ADRs, the core/client package sources —
live in the **committed snapshot `accord/`**, so the site builds and deploys
from this repository alone (the deploy host has no sibling checkout). Refresh
the snapshot when the Accord repository moves:

```sh
npm ci
npm run dev            # predev: brand + sync-app (skips without ../app) + check-facts
npm run build          # prebuild + static export into out/
npm run sync:app       # refresh accord/ from ../app (ACCORD_APP_DIR to override)
npm run lint | typecheck | format
npm run check:links      # every link in out/ resolves; no third-party domains
npm run check:snippets   # type-checks content/snippets against accord/packages/*
```

`npm run build` works from a clean clone with only `npm ci` (website.md
section 10). With the Accord repository checked out at `../app`, prebuild also
refreshes the snapshot automatically; check-facts always reads the snapshot,
never a live checkout, and CI's `drift` job fails when `accord/` has fallen
behind `crossben/accordsync`.

## What is on the page, and what is hidden

Sections that wait for `app/` to catch up are controlled only by
[`content/features.ts`](content/features.ts) — turning one on is a one-line PR.
Current state (2026-10-02: M1 merge core, M2 simulator + convergence suite, M3 server and M4 client have landed in `app/`; the merge-rules doc exists, so `mergeRulesFromAppDocs` can flip next; the playground is unblocked but its component is not built yet):

| Flag                                   | State  | Unlocks when                                                                                                                                                              |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quickstart`                           | **on** | app/README.md, section Develop exists since M0 (server + PostgreSQL + health check)                                                                                       |
| `repoLinks.docs / changelog / license` | **on** | app/docs, app/CHANGELOG.md, app/LICENSE exist                                                                                                                             |
| `repoLinks.contributing / security`    | off    | app/CONTRIBUTING.md, app/SECURITY.md land                                                                                                                                 |
| `mergeRulesFromAppDocs`                | off    | app/docs/merge-rules.md exists (table is generated from facts.ts meanwhile)                                                                                               |
| `snippetsCheckedAgainstApp`            | **on** | app/packages export the real API (`defineSchema`, `AccordClient.open`, `httpTransport`, `resolve`); `check:snippets` type-checks the snippets against them on every build |
| `playground`                           | off    | milestone M2 (the playground must run the real `@accordsync/core`)                                                                                                        |
| `proofNumbers` / `loadTest`            | off    | CI publishes committed report files / app/load/ numbers with hardware                                                                                                     |
| `screenshots`                          | off    | app/examples/field-app (M5)                                                                                                                                               |

## Facts: tier moves made in this build

Two facts moved `designed` → `built` because `app/` proved them while this site
was being built (the mechanism of website.md section 4):

- **TypeScript everywhere / one pure merge core** — ADR-0002 accepted,
  pnpm workspace live, `packages/client` imports `@accordsync/core`
  (checked in `scripts/check-facts.mjs` against `docs/adr/0002-typescript-everywhere.md`).
- **Licence Apache-2.0** — app/README.md, section Licence + app/LICENSE exist since M0.

Everything else (HLC, strategies, counter/conflict guarantees, resumable sync,
scopes, convergence proofs) is still `designed` in `app/` and is written as
intent on the site. The version fact is guarded the other way: the moment
app/CHANGELOG.md grows a release heading, `check-facts` fails until the
status line ("In development: not released yet. …") is updated.

## Stack

Same stack as the Yoon website (website.md section 1): Next.js 16.3.8, App Router,
`output: "export"` (fully static, `out/`), TypeScript strict, Tailwind CSS v4
(CSS-first), GSAP + ScrollTrigger + `@gsap/react`, plain `three` (not
react-three-fiber), Shiki at build time, self-hosted fonts via `next/font`
(nothing loads from a CDN at runtime), no analytics, no cookies, no
third-party requests (enforced by `check:links`).

- **Text font: Inter Tight** (chosen over IBM Plex Sans): it is cut for large
  display sizes — the tight spacing keeps the big hero headline compact — while
  staying a neutral UI face at body sizes, and it pairs naturally with
  JetBrains Mono. IBM Plex Sans reads more "document" than "product" at
  display sizes.
- **GSAP licence note (owner decision, website.md section 11):** GSAP is free
  including commercial use but ships under its own Standard no-charge licence,
  not an open-source licence. The site's code is Apache-2.0; GSAP remains under
  its own terms. If you want open-source-only dependencies, GSAP can be swapped
  for Motion One / Web Animations — say the word before the first deploy.

## Measured contrast ratios (WCAG)

Re-verified for this build (README of the plan lists the same values):

| Pair                              | Ratio   |
| --------------------------------- | ------- |
| ink on bg (light)                 | 15.02:1 |
| muted on bg (light)               | 5.77:1  |
| accent on bg (light)              | 5.81:1  |
| accent on surface (light)         | 6.38:1  |
| conflict on bg (light)            | 5.69:1  |
| conflict on surface (light)       | 6.25:1  |
| muted on surface (light)          | 6.33:1  |
| ink on bg (dark)                  | 15.39:1 |
| muted on bg (dark)                | 7.40:1  |
| accent on bg (dark)               | 8.52:1  |
| accent on surface (dark)          | 7.53:1  |
| conflict on bg (dark)             | 8.66:1  |
| white on accent (light button)    | 6.38:1  |
| bg (dark) on accent (dark button) | 8.52:1  |

All pass WCAG AA for body text. Colour never carries meaning alone: offline and
conflict states always come with a text label or marker (section 2).

## Measured bundle sizes (next build, gzipped)

| Load                                      | Size       | Budget (section 8) |
| ----------------------------------------- | ---------- | ------------------ |
| Initial JS before interactive (8 chunks)  | ~228 kB gz | ~100 kB            |
| three.js hero scene (separate idle chunk) | ~135 kB gz | ~180 kB ✓          |
| Total `out/`                              | 2.5 MB     | —                  |

**The initial-load budget is over, and this is the shared stack's baseline, not
a site-specific regression:** the identical measurement on the Yoon website
(same Next 16.3.8 + React 19.3 + GSAP stack) gives ~234 kB. React 19 + the
Next 16 runtime alone account for ~165 kB gz before any site code; GSAP with
ScrollTrigger and TextPlugin adds ~45 kB. The plan's ~100 kB figure was written
against an older baseline. If the budget is hard, the options are (a) swap GSAP
for Motion One (~30 kB saved, owner decision on the licence anyway) or (b)
accept the stack baseline and keep the scene, which is already its own
idle-loaded chunk. Nothing on the page blocks interaction on the scene: the LCP
is the hero text, the scene loads after `window.load` + idle, and CLS is
handled with fixed-height containers.

Also verified locally: responsive from 360 px with no horizontal scroll,
skip link + visible focus rings, ARIA tabs with arrow keys, pause button on the
scene, static SVG fallback (no WebGL / reduced motion / Save-Data), the
timeline and terminal render their final state without JavaScript. Lighthouse
has **not** been run yet — attach the mobile report (section 8: ≥95 / 100 / 100 / 100)
to the PR from a machine with Chrome.

## Brand (proposal, owner approval pending — section 11)

`public/brand/` holds the proposed files: `logo.svg`, `logo-dark.svg` (mark +
"Accord" wordmark in Inter Tight Medium, converted to paths), `mark.svg`,
`icon.svg`, and a 1200×630 `social-preview.png`. The mark is three strokes that
start apart and merge into one line — a merge in a git graph; replicas coming
to an accord. Single colour, no gradients, legible at 16 px.

After approval the files move to `app/docs/assets/` (a PR for the owner — this
repo never writes to `app/`), and `scripts/copy-brand.mjs` (already wired into
predev/prebuild) copies them from there at build time so there is one source of
truth. Until then the local files are used as-is.

## Discoverability (SEO, llms.txt)

Everything is generated at build time into `out/`, per language and with no
third-party services:

- **Per-language metadata** (both layouts): title, description, canonical,
  `hreflang` alternates including `x-default`, Open Graph with
  `og:locale`/`og:locale:alternate`, Twitter card, `authors`/`creator`
  (Ben Hattab), `applicationName`, and light/dark `theme-color` via the
  viewport export.
- **Icons**: SVG + 32 px PNG favicon and a 180 px Apple touch icon, generated
  from the brand mark (`public/brand/`).
- **Web manifest** (`app/manifest.ts` → `manifest.webmanifest`): install
  metadata, theme colours, icon set.
- **`robots.txt`** and **`sitemap.xml`** (with hreflang alternates) — Next
  metadata routes, built static.
- **`/llms.txt`** (`app/llms.txt/route.ts`): the llmstxt.org convention for
  LLM crawlers — an H1, an honest status summary ("in development, not
  released"), sections linking the page (EN/FR), the repository (README,
  CHANGELOG, ADRs, LICENSE) and a Facts section restating the facts sheet so
  models quoting the site inherit its hedges. Generated from
  `content/facts.ts` at build time; it cannot drift from the facts sheet.
- **JSON-LD `@graph`**: `WebSite` (per-language `inLanguage`) +
  `SoftwareSourceCode` (repository, Apache-2.0, TypeScript, Node.js runtime,
  author, keywords) on both pages.

Deliberately **not** added: `meta keywords` (ignored by search engines), search-console verification tags (need the owner's IDs), and any
analytics. When the owner picks the final domain, update it in
`app/(en)/layout.tsx`, `app/(fr)/layout.tsx`, `app/sitemap.ts`,
`app/robots.ts`, `app/llms.txt/route.ts`, `app/manifest.ts` (start_url) and
`scripts/check-links.mjs` together.

## CI

`.github/workflows/ci.yml` has two jobs:

- **build** — checks out this repo only (no token, no sibling checkout: the
  build reads the committed `accord/` snapshot) and runs check-facts, lint,
  typecheck, check:snippets, build, check:links, then uploads `out/`.
- **drift** — on pushes to main and on a daily schedule, checks out
  `crossben/accordsync` into `accord-src/` (never `app/` — that name is the
  website's own Next.js routes directory) with a read-only fine-grained PAT
  stored in the secret `ACCORD_APP_READ_TOKEN` (Contents: read on that repo
  only — the owner creates it), re-runs `sync:app --require`, and fails when
  the committed `accord/` differs from the repository. When it fires: run
  `npm run sync:app`, update facts/copy if check-facts asks, and commit the
  refreshed snapshot.

## Deployment (owner decision pending, section 11)

No deploy step is implemented. Options, per website.md section 9:

- **Docker** (same setup as the Yoon website): `docker compose up --build -d`
  builds the site in a multi-stage image and serves `out/` with Caddy on
  container port 3000 (HTTPS terminated in front of it). The image builds from
  this repository alone — the committed `accord/` snapshot carries the Accord
  sources — so any host that clones this repo can build it, and the facts
  guard still runs inside the image build.
- **Cloudflare Pages** — connect the repo, build command `npm run build`, output
  `out`. No extra setup: the snapshot is committed.
- **Any static web server** — upload `out/`; it is plain HTML/CSS/JS.

**Do not deploy before the repositories are public**: GitHub links on the site
(currently `crossben/accordsync`) 404 for visitors until then (section 11).

## Owner decisions still open (website.md section 11)

1. Domain (provisional canonical: `accord.benhattab.pro` — change it in
   `app/(en)/layout.tsx`, `app/(fr)/layout.tsx`, `app/sitemap.ts`,
   `app/robots.ts`, `scripts/check-links.mjs`) and host.
2. Logo + palette approval (above).
3. Licence confirmation — the site already states Apache-2.0 as `built` because
   app/ states it; say so if that is wrong.
4. When the repositories go public (gates deployment).
5. GSAP licence acceptable, or open-source-only animation (see Stack).
6. French copy review (`content/fr.ts`) before launch.
7. Contact details beyond GitHub, if any.

## Interpretations made (flag anything you disagree with)

- **"Link to plan.md section 6"** for the planned guarantees/proof: plan.md lives in
  the workspace, not necessarily in the git repository, so the link points at
  the repository root (`repo.planProof`) with the label "the plan, section 6". If
  plan.md lands in the repo, point the URL at the file.
- **Quick start unlocked at M0**: website.md section 5.9 says hidden until the
  quick-start section exists in app/README.md — the Develop section exists
  (M0), so the section is on, with its commands and the real health response
  guarded by `check-facts`. Flip `features.quickstart` off if you'd rather wait
  for a fuller README.
- **Footer status line**: shows the required "in development" line until
  v0.1.0; `content/facts.ts` `version` flips to the version string in the same
  PR as the tag.
- **Word count**: measured on the built pages, excluding code blocks and the
  SVG diagrams: ~1 200 words EN / ~1 330 FR counted — and that counter also
  sees the sr-only strings and UI chrome (nav labels, buttons, badges). Visible
  prose is ≈ 1 080 EN / ≈ 1 180 FR, under the 1 200 budget (section 5). French runs
  ~8 % longer than English; if the reviewer counts differently, the copy can
  lose the sr-only scene description's length and a few card bodies.
