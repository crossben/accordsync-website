// English copy (website.md section 3). Every factual sentence traces to a fact in
// content/facts.ts; designed facts are written as intent and carry the Planned
// badge. Word budget: under 1 200 words (website.md section 5).
import type { Content } from "@/content/types";

export const en: Content = {
  lang: "en",
  otherLang: { label: "Français", href: "/fr/" },

  meta: {
    title: "Accord — offline-first sync that stays correct when the network lies",
    description:
      "Accord is an open-source, self-hosted offline-first sync engine: local-first writes, operations instead of overwrites, declared merge rules, and conflicts your app decides. TypeScript and PostgreSQL.",
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
      run: "Run it",
      openSource: "Open source",
    },
    themeToggle: { toDark: "Switch to dark theme", toLight: "Switch to light theme" },
  },

  hero: {
    kicker: "Every device, in accord.",
    headline: "Offline-first sync that stays correct when the network lies.",
    subline:
      "Accord is an open-source, self-hosted sync engine for field apps: data lives in local SQLite or IndexedDB, truth in PostgreSQL on the server, replicas merged by declared rules instead of luck.",
    ctaHow: "How it works",
    ctaGithub: "GitHub",
    statusLine: "v{version} — first release, {date}. Pre-1.0: the API may still change.",
    scene: {
      labels: {
        devices: ["Device A", "Device B", "Device C"],
        server: "Server",
        offline: "offline",
      },
      description:
        "Illustration of the sync design: three devices write offline while operations pile up, reconnect, exchange operations with the server, and end with identical state. Two devices edit the same conflict() field; afterwards every device shows both values, marked as conflicting — never one quietly winning. An illustration, not a live view.",
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
        body: "Field apps run where the network drops for minutes or days: enrolment agents, waste collectors, shopkeepers. An app stuck on a connection dialog blocks real work.",
      },
      {
        title: "Last write wins is a coin toss",
        body: "The usual fix — keep the latest edit, throw the rest away — silently loses one agent's work. Last write wins is not an accord; it is a coin toss.",
      },
      {
        title: "Some fields deserve a meeting",
        body: "Two agents edit the same dossier offline. An engine that picks a winner picked it for you. On money and legal status, both values surface, and the app decides.",
      },
    ],
  },

  how: {
    heading: "How sync works",
    intro: "These steps follow one write from a device to every replica.",
    planned: { label: "Planned", title: "Planned — described as designed, not built yet" },
    steps: [
      {
        title: "Write locally, always",
        body: "Every action lands in local SQLite or IndexedDB first. The network is never on the critical path of a user action.",
      },
      {
        title: "Record operations, not overwrites",
        body: "A write becomes an operation in an append-only log — op id, field, value, hybrid logical clock. Replayed twice, an op changes nothing.",
      },
      {
        title: "Go offline",
        body: "Nothing special happens. The device keeps working and collects ops while the link is down.",
      },
      {
        title: "Reconnect and sync both ways",
        body: "Ops push in idempotent batches and pull in resumable pages — a device offline for three days resumes where it stopped.",
      },
      {
        title: "Merge by declared rules",
        body: "Each field declares a strategy. The server enforces sync scopes and reports refused ops back to the client — never dropped silently.",
      },
      {
        title: "Converge",
        body: "Every replica merges to the same state, and a conflict() field still shows both values until the app resolves it.",
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
      finalConflictA: "approved",
      finalConflictB: "rejected",
      keptBoth: "both values kept",
      converged: "in accord — identical state on every replica",
    },
  },

  merges: {
    heading: "Merge rules",
    intro:
      "Every field declares its strategy in the schema, and the strategy decides who wins. conflict(): some disagreements deserve a meeting.",
    planned: { label: "Planned", title: "Planned — the strategies are designed, not built yet" },
    note: "Each rule is pinned down by golden test vectors every implementation must pass. Ordered lists (a sequence CRDT) are planned after v1 — most field-app lists are really sets.",
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
          rule: "Sum of increments — none lost, under any delivery order.",
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
          rule: "Never auto-resolved: both values kept, the record flagged, the app decides.",
          before: "A: “approved” · B: “rejected”",
          after: "“approved” | “rejected” — flagged",
        },
      },
    },
  },

  guarantees: {
    heading: "What Accord guarantees",
    intro:
      "Only guarantees with proof belong here: each one links the test in the repository that proves it.",
    planned: { label: "Planned", title: "Planned — awaiting a passing test in the repository" },
    whyLabel: "Why it matters:",
    testLink: "The test",
    sourceLink: { label: "Design decisions (ADRs)" },
    items: {
      convergence: {
        title: "Every replica converges",
        body: "After sync, every replica holds an identical state — checked by thousands of generated runs under dropped, delayed, duplicated and reordered messages.",
        why: "Offline days are normal; divergence is silent.",
      },
      counters: {
        title: "Counters never lose an increment",
        body: "A counter equals the sum of all the increments the server accepted, under any delivery order.",
        why: "Collected quantities and stock must add up.",
      },
      conflicts: {
        title: "conflict() is never auto-resolved",
        body: "Fields marked conflict() surface every concurrent value and stay flagged until the app resolves them.",
        why: "Accord never guesses on money or legal status.",
      },
      idempotent: {
        title: "Replayed ops change nothing",
        body: "Operations are idempotent: applying one twice changes nothing, so resending a batch after a dropped connection is harmless.",
        why: "Mobile networks drop mid-batch, all the time.",
      },
      resumable: {
        title: "Sync resumes, days later",
        body: "A device offline for days syncs in resumable pages: if it dies at page 7, it resumes at page 7.",
        why: "Long outages are the whole point of offline-first.",
      },
      scopes: {
        title: "Scopes are enforced on the server",
        body: "The server filters every pull and refuses every op outside a user's scope; the device rolls the refused change back and tells the app.",
        why: "A silently diverging client is a data bug waiting.",
      },
    },
  },

  code: {
    heading: "Your code",
    intro:
      "Three moments of a field app's day with the real client API: define a schema, write offline, resolve the conflicts Accord refuses to guess on. The snippets type-check against the actual packages in CI.",
    previewLabel: "API preview: may change before v0.1",
    tabLabels: {
      schema: "Define a schema",
      offline: "Write offline",
      conflict: "Resolve a conflict",
    },
    copy: "Copy",
    copied: "Copied",
    screenshot: {
      alt: "The Accord field-app example: a dossier where two agents set different statuses while offline. Visits show 3, and a box says “Agents disagree. Accord kept every value. Which one is right?” with a button for each value.",
      caption:
        "The field-app example in the repository, after two agents edited the same dossier offline: every visit counted, and the status they disagree on waits for a human.",
      link: "examples/field-app",
    },
  },

  quickstart: {
    heading: "Run it yourself",
    intro:
      "The repository's quick start: PostgreSQL and the sync server in Docker Compose, with an example configuration.",
    steps: [
      {
        title: "Clone the repository",
        body: "The server, the client, the example apps and the docs live in one repository.",
        commands: ["git clone https://github.com/crossben/accordsync", "cd accordsync"],
      },
      {
        title: "Start PostgreSQL and the server",
        body: "Docker Compose builds the image and starts both.",
        commands: ["docker compose up --build"],
      },
      {
        title: "Check health",
        body: "The server answers with the protocol version it speaks.",
        commands: ["curl localhost:8080/health"],
      },
    ],
    note: "Node 22.12+ and pnpm 11 if you want to develop on Accord itself; the server tests start PostgreSQL 16 with Testcontainers.",
    terminalLabel: "Terminal",
    terminalNote: "Real commands and the real health response — from the endpoint's own test.",
  },

  proof: {
    heading: "Proof",
    intro: "Correctness is a test suite, not a promise. These suites run on every change.",
    planned: { label: "Planned", title: "Planned — the test suites are being built" },
    items: {
      convergenceTest: {
        title: "Convergence property tests",
        body: "Generated runs of devices going offline, editing and reconnecting, with random network faults. Every replica must end identical; failures shrink to a minimal example.",
      },
      strategyLaws: {
        title: "Strategy laws",
        body: "Each strategy is tested for commutativity, associativity and idempotency, so implementations can never disagree — future ports included.",
      },
      simulator: {
        title: "Seeded simulator",
        body: "A deterministic network simulator — drop, delay, duplicate, reorder, partition. A CI failure replays locally with the same seed.",
      },
    },
    testLink: "The tests",
    ciLine:
      "Each CI run generates {simulations} simulated networks and {propertyCases} cases per strategy law; a failure prints the seed that replays it.",
    load: {
      heading: "Under load",
      intro:
        "k6 devices pushing batches of 10 ops and pulling pages, non-stop, for 60 seconds per run. Pushes are serialized on purpose, so a pull can never skip an op: more devices wait longer, they do not add throughput.",
      columns: { devices: "Devices", ops: "Ops/s accepted", push: "Push p95", pull: "Pull p95" },
      hardwareLabel: "Measured on:",
      caveat:
        "No failed requests. One machine and a synthetic workload: run it on your own setup before relying on it.",
      link: "Method and raw results",
    },
  },

  not: {
    heading: "What Accord is not",
    intro: "Plainly, because an honest boundary is part of the pitch.",
    items: {
      database: {
        title: "Not a database",
        body: "Accord syncs records defined by your schema. It is not a query engine and does not replace PostgreSQL or SQLite — it moves changes between them.",
      },
      collab: {
        title: "Not real-time text collaboration",
        body: "No shared rich-text editing in v1. Fields are scalars, sets and counters.",
      },
      business: {
        title: "Not magic for business conflicts",
        body: "Two agents approving the same dossier differently is a business decision. Accord surfaces it for your app to resolve, instead of guessing.",
      },
    },
  },

  openSource: {
    heading: "Open source",
    licence: {
      title: "Licence",
      body: "Accord's code is Apache-2.0 — short, permissive, and safe for employers' legal teams. This website's code is Apache-2.0 too.",
    },
    contribute: {
      title: "Contribute",
      body: "Issues and pull requests are welcome. A failing seed from the convergence suite is the best bug report there is.",
    },
    security: {
      title: "Security",
      body: "Report vulnerabilities privately through GitHub. A checklist in the docs says what the server enforces and what you configure.",
    },
    roadmap: {
      title: "Roadmap",
      body: "After v1: a Dart/Flutter client, ordered lists with their own proofs, attachments with resumable upload. A small v1 that is provably correct beats a big one that mostly works.",
    },
  },

  footer: {
    tagline: "Built for networks that lie.",
    statusLine: "v{version} — first release, {date}. Pre-1.0.",
    copyright: "© 2026 Ben Hattab",
    linkLabels: { github: "GitHub", docs: "Docs", changelog: "Changelog", license: "Licence" },
  },
};
