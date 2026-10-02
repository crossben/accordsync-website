// English copy (website.md §3). Every factual sentence traces to a fact in
// content/facts.ts; designed facts are written as intent and carry the Planned
// badge. Word budget: under 1 200 words (website.md §5).
import type { Content } from "@/content/types";

export const en: Content = {
  lang: "en",
  otherLang: { label: "Français", href: "/fr/" },

  meta: {
    title: "Accord — offline-first sync that stays correct when the network lies",
    description:
      "Accord is an open-source, self-hosted offline-first sync engine in development: local-first writes, operations instead of overwrites, declared merge rules, and conflicts your app decides. TypeScript and PostgreSQL.",
  },

  header: {
    skipToContent: "Skip to content",
    homeAria: "Accord — back to top",
    nav: {
      problem: "Problem",
      how: "How it works",
      merges: "Merge rules",
      guarantees: "Guarantees",
      code: "Your code",
      proof: "Proof",
      openSource: "Open source",
    },
    themeToggle: { toDark: "Switch to dark theme", toLight: "Switch to light theme" },
  },

  hero: {
    kicker: "Every device, in accord.",
    headline: "Offline-first sync that stays correct when the network lies.",
    subline:
      "Accord is an open-source, self-hosted sync engine in development for field apps. Data lives in local SQLite or IndexedDB on the device, truth lives in PostgreSQL on the server, and replicas merge by declared rules instead of luck.",
    ctaHow: "How it works",
    ctaGithub: "GitHub",
    statusLine: "In development: not released yet. Follow along on GitHub.",
    scene: {
      labels: { devices: ["Device A", "Device B", "Device C"], server: "Server", offline: "offline" },
      description:
        "Illustration of how Accord is designed to sync: three devices write changes offline while operations pile up beside them, reconnect to the server, exchange operations in arbitrary order, and end with identical state. In one cycle, two devices edit the same conflict() field; after syncing, every device shows both values marked as conflicting, never one quietly winning over the other. This is an illustration, not a live view.",
      pause: "Pause the animation",
      play: "Play the animation",
      caption: "Illustration. Not a live view.",
    },
  },

  problem: {
    heading: "The network drops. The work can't.",
    cards: [
      {
        title: "“Please reconnect” is not an answer",
        body: "Field apps run where the network drops for minutes or days: enrolment agents, waste collectors, shopkeepers. An app that stalls on a connection dialog blocks real work for as long as the tower is down.",
      },
      {
        title: "Last write wins is a coin toss",
        body: "The usual fix — keep the latest edit, throw the rest away — silently loses one agent's work. Nobody notices until the numbers stop adding up. Last write wins is not an accord; it is a coin toss.",
      },
      {
        title: "Some fields deserve a meeting",
        body: "Two agents edit the same dossier offline. An engine that picks a winner picked it for you. On money and legal status, both values must surface and the app — a human, really — decides.",
      },
    ],
  },

  how: {
    heading: "How sync works",
    intro:
      "This is the v1 design, written as intent — it is what the implementation in the open is being held to. The steps below describe how a write travels from one device to all of them.",
    planned: { label: "Planned", title: "Planned — described as designed, not built yet" },
    steps: [
      {
        title: "Write locally, always",
        body: "Every user action lands in local SQLite or IndexedDB first. The network is never on the critical path of a user action.",
      },
      {
        title: "Record operations, not overwrites",
        body: "A write becomes an operation in an append-only log — op id, field, value, hybrid logical clock. Replaying an op twice is a no-op.",
      },
      {
        title: "Go offline",
        body: "Nothing special happens. The device keeps working and collects ops while the link is down.",
      },
      {
        title: "Reconnect and sync both ways",
        body: "Ops push in idempotent batches and pull in resumable pages. A device offline for three days syncs where it stopped, not from scratch.",
      },
      {
        title: "Merge by declared rules",
        body: "Each field declares a strategy. The server enforces sync scopes, and an op outside a scope is reported back to the client as refused — never dropped silently.",
      },
      {
        title: "Converge",
        body: "Every replica merges to the same state. A conflict() field still shows both values until the app resolves it.",
      },
    ],
    timeline: {
      deviceA: "Device A",
      deviceB: "Device B",
      server: "Server",
      networkDown: "network down",
      opCounterA: "visits +3",
      opCounterB: "visits +2",
      opStatusA: "status = “approved”",
      opStatusB: "status = “rejected”",
      hlcCounterA: "hlc …:0004:A",
      hlcCounterB: "hlc …:0003:B",
      hlcStatusA: "hlc …:0007:A",
      hlcStatusB: "hlc …:0006:B",
      counterRow: "visits — counter()",
      conflictRow: "status — conflict()",
      finalCounter: "3 + 2 = 5",
      finalConflictA: "“approved”",
      finalConflictB: "“rejected”",
      keptBoth: "both values kept",
      converged: "in accord — identical state on every replica",
    },
  },

  merges: {
    heading: "Merge rules",
    intro:
      "Every field declares its strategy in the schema, and the strategy decides who wins. This is the planned v1 set. conflict(): some disagreements deserve a meeting.",
    planned: { label: "Planned", title: "Planned — the strategies are designed, not built yet" },
    note:
      "Ordered lists (a sequence CRDT) are planned after v1, not in it — most field-app lists are really sets. This table will be generated from docs/merge-rules.md in the repository once those docs land.",
    table: {
      columns: { strategy: "Strategy", useFor: "Use for", rule: "Rule", example: "Example" },
      rows: {
        lww: {
          useFor: "Names, notes, simple scalars",
          rule: "Highest hybrid logical clock wins.",
          before: "client_name: “Awa”",
          after: "“Awa Ndiaye” — written later",
        },
        counter: {
          useFor: "Quantities collected, stock adjustments",
          rule: "Sum of increments — no increment is lost, under any delivery order.",
          before: "A: +3 · B: +2",
          after: "5 — on every replica",
        },
        set: {
          useFor: "Tags, assigned agents",
          rule: "Add-wins set: an add beats a remove.",
          before: "A: + zone-nord · B: − zone-sud",
          after: "both applied",
        },
        conflict: {
          useFor: "Business-critical fields: status, approval, amount",
          rule: "Never auto-resolved. Both values are kept, the record is flagged conflicted, and the app decides.",
          before: "A: “approved” · B: “rejected”",
          after: "“approved” | “rejected” — flagged",
        },
      },
    },
  },

  guarantees: {
    heading: "What Accord guarantees",
    intro:
      "This section carries only guarantees with proof — a passing test in the repository. None has landed yet, so every item below is planned. Each will link to its test or ADR the day it becomes true.",
    planned: { label: "Planned", title: "Planned — awaiting a passing test in the repository" },
    whyLabel: "Why it matters:",
    sourceLink: { label: "crossben/accordsync — the plan, §6" },
    items: {
      convergence: {
        title: "Every replica converges",
        body: "After sync, all replicas hold an identical state — designed to be proven by property-based tests that inject random network faults.",
        why: "Offline days are the normal case, not the exception, and divergence is silent.",
      },
      counters: {
        title: "Counters never lose an increment",
        body: "A counter field is designed to equal the sum of all increments ever made, under any delivery order.",
        why: "Collected quantities and stock adjustments have to add up.",
      },
      conflicts: {
        title: "conflict() is never auto-resolved",
        body: "Fields marked conflict() are designed to surface both values and stay flagged until the app resolves them.",
        why: "Accord never guesses on money or legal status.",
      },
      idempotent: {
        title: "Replayed ops change nothing",
        body: "Operations are designed to be idempotent: applying one twice is a no-op, so resending a batch after a dropped connection is harmless.",
        why: "Mobile networks drop mid-batch, all the time.",
      },
      resumable: {
        title: "Sync resumes, days later",
        body: "A device offline for days is designed to sync in resumable pages: if it dies at page 7, it resumes at page 7.",
        why: "Long outages are the whole point of offline-first.",
      },
      scopes: {
        title: "Scopes are enforced on the server",
        body: "The server is designed to filter every pull and reject every op outside a user's sync scope, reporting refused ops back to the client.",
        why: "A client that silently diverges is a data bug waiting to happen.",
      },
    },
  },

  code: {
    heading: "Your code",
    intro:
      "Three moments of a field app's day, sketched against the planned API. Define a schema with per-field merge strategies, write offline, and resolve the conflicts Accord refuses to guess on.",
    previewLabel: "API preview: may change before v0.1",
    tabLabels: { schema: "Define a schema", offline: "Write offline", conflict: "Resolve a conflict" },
    copy: "Copy",
    copied: "Copied",
  },

  proof: {
    heading: "Proof",
    intro:
      "Correctness here is a test suite, not a promise. These are the proofs being built, per the plan's proving-it-correct chapter. Real numbers appear here once CI produces them.",
    planned: { label: "Planned", title: "Planned — the test suites are being built" },
    items: {
      convergenceTest: {
        title: "Convergence property tests",
        body: "Generated runs of devices going offline, editing and reconnecting, with random network faults. After every delivery, every replica must hold an identical state — and failures shrink to a minimal example.",
      },
      strategyLaws: {
        title: "Strategy laws",
        body: "Each merge strategy is tested for commutativity, associativity and idempotency, so implementations can never disagree — future ports included.",
      },
      simulator: {
        title: "Seeded simulator",
        body: "A deterministic network simulator: drop, delay, duplicate, reorder, partition. A CI failure replays locally with the same seed.",
      },
    },
  },

  not: {
    heading: "What Accord is not",
    intro:
      "Plainly, because an honest boundary is part of the pitch.",
    items: {
      database: {
        title: "Not a database",
        body: "Accord syncs records defined by your app's schema. It is not a general query engine, and it does not replace PostgreSQL or SQLite — it moves changes between them.",
      },
      collab: {
        title: "Not real-time text collaboration",
        body: "No shared rich-text editing in v1. Fields are scalars, sets, counters and lists of references.",
      },
      business: {
        title: "Not magic for business conflicts",
        body: "Two agents approving the same dossier differently is a business decision. Accord surfaces it as a conflict for your app to resolve, instead of guessing.",
      },
    },
  },

  openSource: {
    heading: "Open source",
    licence: {
      title: "Licence",
      body: "Apache-2.0 is the planned licence for Accord — short, permissive, and safe for employers' legal teams. This website's own code is already Apache-2.0.",
    },
    contribute: {
      title: "Contribute",
      body: "The repositories are private while the first milestones land. When they open, issues and pull requests are welcome, and CONTRIBUTING.md will be linked from here.",
    },
    security: {
      title: "Security",
      body: "Security reports get a private channel — SECURITY.md in the repository will say how, once it exists.",
    },
    roadmap: {
      title: "Roadmap",
      body: "After v1: a Dart/Flutter client, ordered lists with their own proofs, attachments with resumable upload. A small v1 that is provably correct beats a big one that mostly works.",
    },
  },

  footer: {
    tagline: "Built for networks that lie.",
    statusLine: "In development: not released yet. Follow along on GitHub.",
    copyright: "© 2026 Ben Hattab",
    linkLabels: { github: "GitHub", docs: "Docs", changelog: "Changelog", license: "Licence" },
  },
};
