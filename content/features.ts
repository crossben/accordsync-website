// Feature flags (website.md §5): every section that must stay hidden until `app/`
// catches up is controlled here, so turning one on is a one-line PR. Never hide
// or show a section any other way — the reviewer checks this file (§10).
//
// Current state of app/ decides every flag below. When you flip one, also flip
// the matching fact tier in content/facts.ts if the section starts claiming
// something is `built` rather than `designed`.
export const features = {
  /** §5.4 — generate the merge-rules table by parsing app/docs/merge-rules.md
   *  instead of rendering it from facts.ts. */
  mergeRulesFromAppDocs: false,

  /** §5.6 — snippets are type-checked against app/packages/core and
   *  app/packages/client (npm run check:snippets, wired into CI). While false,
   *  the "Your code" section must carry the "API preview" label. */
  snippetsCheckedAgainstApp: false,

  /** §5.7 — the in-browser playground on the real @accordsync/core + simulator.
   *  Unlock only after milestone M2 lands in app/. */
  playground: false,

  /** §5.8 — real proof numbers (cases per run, etc.) read from a committed
   *  app/ report file produced by CI. */
  proofNumbers: false,

  /** §5.9 — the Docker Compose quick start, copied from app/README.md once
   *  that section exists. */
  quickstart: false,

  /** §4 — load-test numbers; hidden until app/load/ publishes them with the
   *  hardware line. */
  loadTest: false,

  /** §7 — screenshots of app/examples/field-app (after milestone M5). */
  screenshots: false,

  /** Links into files of the Accord repository that do not exist yet:
   *  docs/, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, LICENSE. Flip once
   *  those files land on main. */
  appDocs: false,
} as const;
