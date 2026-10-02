// Feature flags (website.md section 5): every section that must stay hidden until `app/`
// catches up is controlled here, so turning one on is a one-line PR. Never hide
// or show a section any other way — the reviewer checks this file (section 10).
//
// Current state of app/ decides every flag below. When you flip one, also flip
// the matching fact tier in content/facts.ts if the section starts claiming
// something is `built` rather than `designed`.
export const features = {
  /** section 5.4 — generate the merge-rules table by parsing app/docs/merge-rules.md
   *  instead of rendering it from facts.ts. The file does not exist yet. */
  mergeRulesFromAppDocs: false,

  /** section 5.6 — snippets are type-checked against app/packages/core and
   *  app/packages/client by `npm run check:snippets` (wired into CI). On since
   *  the real API landed (defineSchema, AccordClient.open, httpTransport,
   *  resolve): the "Your code" section shows real code without the "API
   *  preview" label. If the check ever fails, flip this off and fix the
   *  snippets in the same PR. */
  snippetsCheckedAgainstApp: true,

  /** section 5.7 — the in-browser playground on the real @accordsync/core + simulator.
   *  Unlock only when milestone M2 lands (convergence suite passing). */
  playground: false,

  /** section 5.8 — real proof numbers (cases per run, etc.) read from a committed
   *  app/ report file produced by CI. */
  proofNumbers: false,

  /** section 5.9 — the Docker Compose quick start. app/README.md, section Develop exists
   *  since M0 (server + PostgreSQL + health check), with the commands and the
   *  real health output checked by check-facts.mjs. */
  quickstart: true,

  /** section 4 — load-test numbers; hidden until app/load/ publishes them with the
   *  hardware line. */
  loadTest: false,

  /** section 7 — screenshots of app/examples/field-app (after milestone M5). */
  screenshots: false,

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
    /** app/CONTRIBUTING.md — not yet. */
    contributing: false,
    /** app/SECURITY.md — not yet. */
    security: false,
  },
} as const;
