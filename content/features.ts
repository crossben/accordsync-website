// Feature flags (website.md section 5): every section that must stay hidden until `app/`
// catches up is controlled here, so turning one on is a one-line PR. Never hide
// or show a section any other way — the reviewer checks this file (section 10).
//
// Current state of app/ decides every flag below. When you flip one, also flip
// the matching fact tier in content/facts.ts if the section starts claiming
// something is `built` rather than `designed`.
export const features = {
  /** section 5.4 — generate the merge-rules table by parsing app/docs/merge-rules.md
   *  instead of rendering it from facts.ts. The file exists since M1, but it is English-only:
   *  the French table would lose its translation. Kept off on purpose; the table links to
   *  the file, and check-facts.mjs asserts its four strategies are still documented there. */
  mergeRulesFromAppDocs: false,

  /** section 5.6 — snippets are type-checked against app/packages/core and
   *  app/packages/client by `npm run check:snippets` (wired into CI). On since
   *  the real API landed (defineSchema, AccordClient.open, httpTransport,
   *  resolve): the "Your code" section shows real code without the "API
   *  preview" label. If the check ever fails, flip this off and fix the
   *  snippets in the same PR. */
  snippetsCheckedAgainstApp: true,

  /** section 5.7 — the in-browser playground on the real @accordsync/core + simulator.
   *  On since M2 (the convergence suite passes): the playground imports the
   *  published 0.1.0 packages and contains no strategy code of its own. */
  playground: true,

  /** section 5.8 — real proof numbers: CI case counts from app/.github/workflows/ci.yml,
   *  checked by check-facts.mjs. */
  proofNumbers: true,

  /** section 5.9 — the Docker Compose quick start. app/README.md, section Develop exists
   *  since M0 (server + PostgreSQL + health check), with the commands and the
   *  real health output checked by check-facts.mjs. */
  quickstart: true,

  /** section 4 — load-test numbers from app/load/README.md, with the hardware line. */
  loadTest: true,

  /** section 7 — the real screenshot of app/examples/field-app (M5). */
  screenshots: true,

  /**
   * section 8 — links into Accord-repository files. Gated one by one, because the
   * files land at different times: a link that does not exist yet must be
   * behind a flag, not dead. Flip each when the file lands on main.
   */
  repoLinks: {
    /** app/docs/ — the ADR index exists (docs/adr/). */
    docs: true,
    /** app/CHANGELOG.md exists (Unreleased: M0). */
    changelog: true,
    /** app/LICENSE exists; README states Apache-2.0. */
    license: true,
    /** app/CONTRIBUTING.md exists. */
    contributing: true,
    /** app/SECURITY.md exists. */
    security: true,
  },
} as const;
