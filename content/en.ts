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
      "Accord is an open-source, self-hosted offline-first sync engine: local-first writes, operations instead of overwrites, declared merge rules, and conflicts your app decides. Clients and servers in TypeScript, Dart, PHP and Python, on PostgreSQL.",
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
      playground: "Try it",
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
    statusLine: "v{version}, released {date}. Pre-1.0: the API may still change.",
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
      "One command creates a working project from the published packages: a schema, a server configuration, PostgreSQL in Docker Compose and a client.",
    steps: [
      {
        title: "Create a project",
        body: "Node 22.18 or later and Docker.",
        commands: ["npm create accord my-app", "cd my-app", "safe-install install"],
      },
      {
        title: "Start PostgreSQL and the server",
        body: "The project's Compose file runs PostgreSQL; the server runs from the installed packages.",
        commands: ["docker compose up -d", "cp .env.example .env", "safe-install run server"],
      },
      {
        title: "Run a device",
        body: "In another terminal: the example client writes four changes offline, then syncs.",
        commands: ["safe-install run client"],
      },
    ],
    safeInstall: {
      title: "Why safe-install",
      body: "Installing a package can run its install scripts: code from the network, on your machine. safe-install is a drop-in for npm, pnpm, yarn and bun that installs with every install script off and runs none until you approve it. With npm instead: npm install, npm run server, npm run client.",
      link: "About safe-install",
    },
    note: "To work on Accord itself (pnpm, the test suites), see the repository README.",
    terminalLabel: "Terminal",
    terminalNote: "Real commands; the last line is what the example client prints after it syncs.",
  },

  playground: {
    heading: "Try it",
    intro:
      "Two field agents, one client file, no network. These phones run the real @accordsync/core in your browser: cut the network, make both agents disagree, and watch what Accord does.",
    noscript:
      "The demo needs JavaScript. The field-app example in the repository shows the same thing with a real server.",
    loading: "Loading the demo…",
    agents: ["Awa", "Moussa"],
    airplane: "Airplane mode",
    app: {
      name: "Terrain",
      dossier: "Client file #91",
      client: "Aminata Fall",
      visits: "Visits",
      addVisit: "+ Visit",
      documents: "Documents",
      addDoc: "+ ID card",
      status: "Decision",
      statuses: { draft: "Draft", approved: "Approved", rejected: "Rejected" },
      approve: "Approve",
      reject: "Reject",
      offline: "No network: saved on the phone",
      pending: "{n} waiting to sync",
      synced: "Synced",
      conflictTitle: "Agents disagree",
      conflictBody: "Accord kept both decisions. Which is right?",
      keep: "Keep “{value}”",
    },
    server: { title: "Server", stored: "{n} changes" },
    steps: {
      title: "Try this",
      items: [
        "Put Moussa's phone in airplane mode",
        "Approve on Awa's phone, reject on Moussa's, add a visit on both",
        "Turn airplane mode off: both visits count, both decisions are kept",
        "Pick the right decision: every phone agrees",
      ],
      allDone: "That's Accord: nothing lost, nothing guessed.",
    },
    faults: {
      title: "Stress test",
      run: "Simulate a bad network",
      rerun: "Replay seed {seed}",
      reset: "Start over",
      result:
        "Seed {seed}: {ops} edits on 3 phones, {dropped} messages lost, {duplicated} duplicated, {partitions} network cuts. Once the network came back: {verdict}",
      identical: "every phone identical.",
      diverged: "phones differ. This should never happen: please report the seed.",
    },
    announce: {
      online: "{agent}'s phone is online.",
      offline: "{agent}'s phone is in airplane mode.",
    },
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
        "k6 devices pushing batches of 10 ops and pulling pages, non-stop, for 60 seconds per run. Since v0.2 pushes run concurrently, and several server processes (workers) share the load: about 3 000 ops/s with 4 workers, pulls at p95 ≤ 56 ms.",
      columns: {
        devices: "Devices",
        workers: "Workers",
        ops: "Ops/s accepted",
        push: "Push p95",
        pull: "Pull p95",
      },
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
      body: "Next: ordered lists with their own proofs, attachments with resumable upload. A small v1 that is provably correct beats a big one that mostly works.",
    },
  },

  docs: {
    navLabel: "Docs",
    headerLink: "Docs",
    index: {
      title: "Docs",
      description:
        "Accord developer docs: quick start, schema and merge rules, the client, React and React Native, the server, scope rules, the sync protocol and security.",
      intro:
        "Everything to build an offline-first app on Accord: the client writes locally and syncs, the self-hosted server merges by your rules. Every code example on these pages is read from the repository at build time, so it matches the published packages.",
      install: "Start a project in one command:",
    },
    metaTitles: {
      index: "Offline-first sync for web, mobile and servers",
      quickstart: "Quick start: an offline-first sync project in one command",
      schema: "Merge rules and conflict resolution: lww, counter, set, conflict()",
      client: "TypeScript client: local-first writes and offline sync",
      react: "React hooks for offline-first sync",
      "react-native": "React Native offline sync with SQLite",
      flutter: "Flutter offline sync with drift (Dart)",
      php: "Laravel and Symfony sync server (PHP)",
      python: "Python offline sync, FastAPI and Django sync server",
      server: "Self-hosted sync server on PostgreSQL",
      scopes: "Sync scopes: who reads and writes which records",
      protocol: "Sync protocol: push, pull and resync over HTTPS",
      security: "Sync server security checklist",
    },
    pager: { label: "More docs", previous: "Previous", next: "Next" },
    sourceLabel: "Source",
    fromLabel: "from",
    pages: {
      quickstart: {
        title: "Quick start",
        description:
          "Create an Accord project, run the server and a device that writes offline then syncs.",
        intro:
          "One command creates a working project: a schema, a server configuration, PostgreSQL in Docker Compose, a development token script, and a client.",
        sections: {
          create: {
            title: "Create a project",
            body: ["Requires Node 22.18 or later and Docker."],
          },
          run: {
            title: "Run it",
            body: [
              "Start PostgreSQL and the server, then run the example device: it writes four changes with no network, syncs, and reports zero pending changes.",
              "The commands use safe-install (safe-install.benhattab.pro): installing a package can run its install scripts, and safe-install installs with every install script off and runs none until you approve it. With npm instead: `npm install`, `npm run server`, `npm run client`.",
            ],
          },
          files: {
            title: "What you get",
            body: [],
            items: [
              "`schema.ts`: your records and how each field merges, shared by the server and every client.",
              "`accord.config.ts`: the server, with your scope rules and how tokens are checked.",
              "`client.ts`: a device writing offline, then syncing.",
              "`dev-token.mjs`: development tokens. In production your auth server issues them.",
            ],
          },
        },
      },
      schema: {
        title: "Schema and merge rules",
        description: "Declare how each field merges: lww, counter, set and conflict().",
        intro:
          "Every field declares how concurrent edits merge. Whatever order changes arrive in, and however many times, every device reads the same value.",
        sections: {
          strategies: { title: "The four strategies", body: [] },
          define: {
            title: "Declare a schema",
            body: [
              "The same schema file is used by the server and by every client: import it on both sides.",
            ],
          },
          conflicts: {
            title: "Resolving a conflict()",
            body: [
              "A `conflict()` field keeps every value written concurrently and is flagged. Resolving is a write made while seeing every conflicting value: it replaces exactly those. A value written elsewhere that the resolver had not seen is never erased, and keeps the field conflicted until it is resolved too.",
            ],
          },
        },
      },
      client: {
        title: "Client",
        description:
          "Open the Accord client, write offline, resolve conflicts and react to events.",
        intro:
          "`@accordsync/client` keeps a full working copy of the user's records on the device. Writes apply at once, with no network; sync runs in the background.",
        sections: {
          open: {
            title: "Open and write",
            body: [
              "Each write resolves once it is saved on the device, and is visible to `read` at once. `start()` syncs after writes, every 30 seconds, and backs off while offline.",
            ],
          },
          conflicts: {
            title: "Resolve conflicts",
            body: ["Show each conflicted field with all its values, and let someone decide."],
          },
          events: {
            title: "Events",
            body: [
              "`change` fires when local state changed, `refused` when the server refused a write (already rolled back), `synced` after a sync round, `resync` when the user's data was reloaded, and `error` when a round failed and will be retried.",
            ],
          },
          storage: {
            title: "Storage",
            body: [],
            items: [
              "`IndexedDbStorage`: browsers.",
              "`SqliteStorage`: any SQLite through a two-method driver: wa-sqlite on the web, op-sqlite on React Native, `node:sqlite` or better-sqlite3 in Node.",
              "`MemoryStorage`: tests; unsynced writes are lost on restart.",
            ],
          },
          agent: {
            title: "Prompt for an AI agent",
            body: [
              "Copy this prompt into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app on this platform. It lists what to install and create, how to choose merge rules, what to show users, what not to do, and how to check the result.",
            ],
          },
        },
      },
      react: {
        title: "React",
        description: "React hooks for Accord: useRecord, useRecords, useConflicts, useSyncStatus.",
        intro:
          "`@accordsync/react` gives components the device's records, conflicts and sync status, and re-renders them when local state changes, from a local write or from sync.",
        sections: {
          hooks: { title: "Provider and hooks", body: [] },
          rendering: {
            title: "Re-rendering",
            body: [
              "A component re-renders only when what it reads changed: a record that did not change keeps the same value, so React skips it.",
            ],
          },
          agent: {
            title: "Prompt for an AI agent",
            body: [
              "Copy this prompt into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app on this platform. It lists what to install and create, how to choose merge rules, what to show users, what not to do, and how to check the result.",
            ],
          },
        },
      },
      "react-native": {
        title: "React Native",
        description:
          "Accord on React Native: op-sqlite storage, device ids, and sync around the app lifecycle.",
        intro:
          "Field apps usually run on phones. This sets up the client with on-device SQLite, sync that follows the app's lifecycle, and the React hooks.",
        sections: {
          install: {
            title: "Install",
            body: [
              "op-sqlite is a native module: on Expo, use a development build. Import the random-values polyfill first: the client needs a secure random source for the device id, and stops with an explanation without one.",
            ],
          },
          open: {
            title: "Open the client",
            body: [
              "Leave `deviceId` unset: the client creates one and stores it. Accord's tables are prefixed `accord_`, so they can share your app's database.",
            ],
          },
          lifecycle: {
            title: "Sync around the app lifecycle",
            body: [
              "Sync in the foreground, pause in the background, and sync at once when the network returns. Writes never wait for any of this.",
            ],
          },
          agent: {
            title: "Prompt for an AI agent",
            body: [
              "Copy this prompt into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app on this platform. It lists what to install and create, how to choose merge rules, what to show users, what not to do, and how to check the result.",
            ],
          },
        },
      },
      flutter: {
        title: "Flutter",
        description:
          "Accord for Flutter and Dart: drift storage, widgets, and sync that follows the app lifecycle.",
        intro:
          "The Dart packages speak the same protocol and merge by the same rules as the TypeScript ones, so Flutter phones sync through the same server as web and React Native devices. `accordsync_flutter` adds drift storage, widgets and lifecycle handling to the pure Dart client `accordsync`.",
        sections: {
          install: {
            title: "Install",
            body: [
              "`accordsync_flutter` re-exports the client and the merge core. `drift_flutter` opens the SQLite database on the device.",
            ],
          },
          open: {
            title: "Open the client",
            body: [
              "Declare the same schema as your server. Leave `deviceId` unset: the client creates one with a secure random source and stores it. To keep Accord in your app's existing drift database, pass it to `DriftStorage`: Accord adds four tables prefixed `accord_` and needs no code generation.",
            ],
          },
          lifecycle: {
            title: "Sync around the app lifecycle",
            body: [
              "`AccordLifecycle` syncs in the foreground, pauses in the background, and syncs at once when the network returns. Accord has no connectivity dependency: pass a stream from the package you already use. Writes never wait for any of this.",
            ],
          },
          widgets: {
            title: "Widgets",
            body: [
              "`RecordBuilder` rebuilds when its record changes on the device, from a local write or from sync. `ConflictsBuilder` gives every conflicted field with its values, to resolve with `accord.resolve`. `SyncStatusBuilder` gives pending writes and the last sync. Refused writes arrive on `accord.refusals`, already rolled back.",
            ],
          },
          parity: {
            title: "Same behaviour as TypeScript",
            body: [
              "The Dart core passes the shared golden vectors in every delivery order, and reproduces byte for byte the snapshots of random scenarios generated by the TypeScript core. In CI, Dart and TypeScript clients work together against the real server through a network that loses requests and responses, and must end with identical data.",
            ],
          },
          agent: {
            title: "Prompt for an AI agent",
            body: [
              "Copy this prompt into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app on this platform. It lists what to install and create, how to choose merge rules, what to show users, what not to do, and how to check the result.",
            ],
          },
        },
      },
      php: {
        title: "PHP",
        description:
          "The Accord sync server in PHP, for Laravel, Symfony or plain PHP: same protocol, same merge rules, same PostgreSQL schema.",
        intro:
          "The PHP server speaks the same protocol, merges by the same rules and uses the same PostgreSQL schema as `@accordsync/server`, so every Accord client syncs with it unchanged. Serve sync from your Laravel or Symfony backend: `accordsync/laravel` and `accordsync/symfony` wire the framework-agnostic `accordsync/server` into the framework. PHP 8.3+ with `pdo_pgsql`.",
        sections: {
          install: {
            title: "Install",
            body: [
              "With Symfony, install `accordsync/symfony`; for plain PHP or another framework, `accordsync/server`. Laravel discovers the provider and publishes `config/accord.php`.",
            ],
          },
          define: {
            title: "Define the server",
            body: [
              "`AccordServer::define()` takes the same parts as `defineServer` in TypeScript: the schema, a scope function per record type, the access a user gets from their JWT claims, and how tokens are checked. In Laravel, `config/accord.php` names an invokable class that returns it; the container injects its parameters, here the cache that shares the JWKS between workers.",
            ],
          },
          frameworks: {
            title: "Routes and frameworks",
            body: [
              "The routes are `/accord/health`, `/accord/v1/push` and `/accord/v1/pull` (the prefix is configurable): clients use `https://your-app/accord` as their server URL. They are stateless and authenticate with the bearer token only: no session, cookie or CSRF token.",
              "In Symfony, the same definition goes in a service implementing `Accord\\Symfony\\DefinitionProvider`, and a route import with `type: accord` adds the routes. Without a framework, `AccordServer::handler()` returns a PSR-15 request handler.",
            ],
          },
          migrate: {
            title: "Migrations and compaction",
            body: [
              "The migrations are the TypeScript server's, in the same ledger: a database migrated by either server is up to date for the other. Laravel registers compaction with its scheduler; with Symfony or plain PHP, run it from cron (`bin/console accord:compact`, `vendor/bin/accord compact`). Use a persistent database connection, and a rate-limit store shared by every server.",
            ],
          },
          parity: {
            title: "Same behaviour as TypeScript",
            body: [
              "The PHP core passes the shared golden vectors in every delivery order, and reproduces byte for byte the snapshots of random scenarios generated by the TypeScript core. In CI, the server conformance suite runs against the PHP server and its Laravel and Symfony example apps, and a mixed-server fleet runs the TypeScript and PHP servers on one database at once, with devices sending each request to either through a network that loses requests and responses. Every device must end with identical data.",
            ],
          },
        },
      },
      python: {
        title: "Python",
        description:
          "Accord for Python: a client that writes offline and syncs, and the sync server for FastAPI and Django.",
        intro:
          "The Python client makes a program an Accord device: it writes to SQLite at once and syncs like a phone or a browser. The Python server speaks the same protocol, merges by the same rules and uses the same PostgreSQL schema as `@accordsync/server`, so every Accord client syncs with it unchanged. Python 3.11+.",
        sections: {
          install: {
            title: "Install",
            body: [
              "`accordsync` is the client. `accordsync-fastapi` and `accordsync-django` route to the framework-agnostic `accordsync-server`, which also serves WSGI on its own.",
            ],
          },
          open: {
            title: "Open the client",
            body: [
              "Declare the same schema as your server. Leave `device_id` unset: the client creates one with a secure random source and stores it. `get_token` returns your app's current JWT and is called before every request. Writes return once they are saved on the device, online or not. `set_()` has a trailing underscore so it does not shadow Python's `set`.",
            ],
          },
          conflicts: {
            title: "Conflicts and refusals",
            body: [
              "`accord.conflicts()` gives every conflicted field with its values; resolve one with `accord.resolve`. The `change` event reports records whose local state changed, from a local write or a sync. Refused writes arrive on the `refused` event, already rolled back: tell the user.",
            ],
          },
          server: {
            title: "Define the server",
            body: [
              "`define_server()` takes the same parts as `defineServer` in TypeScript: the schema, a scope function per record type, the access a user gets from their JWT claims, and how tokens are checked. `accord_router` mounts it in FastAPI; the router opens its connection pool in the application's lifespan and closes it at shutdown.",
            ],
          },
          django: {
            title: "Django",
            body: [
              "The database is `ACCORD_DATABASE_URL`, or else the `default` database on PostgreSQL. The sync views use their own psycopg pool, never the ORM's connections; they are CSRF-exempt and need no session. `manage.py check` reports a missing or wrong `ACCORD_SERVER`. Serve with a threaded WSGI server.",
            ],
          },
          migrate: {
            title: "Migrations and compaction",
            body: [
              "The migrations are the TypeScript server's, in the same ledger: a database migrated by either server is up to date for the other. Each server process compacts in a background thread by default; with several worker processes, turn that off and run compaction from cron. Rate limits are kept in memory, per process.",
            ],
          },
          parity: {
            title: "Same behaviour as TypeScript",
            body: [
              "The Python core passes the shared golden vectors in every delivery order, and reproduces byte for byte the snapshots of random scenarios generated by the TypeScript core. In CI, the server conformance suite runs against the Python server and its FastAPI and Django example apps; the Python client runs against the real TypeScript server, alone and with TypeScript devices; and a mixed-server fleet runs the TypeScript and Python servers on one database at once, through a network that loses requests and responses. Every device must end with identical data.",
            ],
          },
          agent: {
            title: "Prompt for an AI agent",
            body: [
              "Copy this prompt into your coding agent (Claude Code, Cursor, Copilot) to add Accord to an existing app on this platform. It lists what to install and create, how to choose merge rules, what to show users, what not to do, and how to check the result.",
            ],
          },
        },
      },
      server: {
        title: "Server",
        description:
          "Configure and run the Accord sync server: scopes, auth, environment, workers and compaction.",
        intro:
          "`@accordsync/server` is a self-hosted sync server on PostgreSQL. You describe your records and who may see them in a TypeScript file, and run `accord serve`.",
        sections: {
          configure: {
            title: "Configure",
            body: [
              "Run it with `accord serve --config accord.config.ts`, or with the Docker image. Production uses `jwksUrl` with an `issuer` and an `audience`.",
            ],
          },
          env: {
            title: "Environment",
            body: [],
            items: [
              "`ACCORD_DATABASE_URL`: the PostgreSQL connection string (required).",
              "`ACCORD_PORT`: the HTTP port (default 8080).",
              "`ACCORD_DB_POOL`: PostgreSQL connections per process (default 20).",
              "`ACCORD_WORKERS`: server processes sharing the port, a number or `auto` (default 1).",
            ],
          },
          scaling: {
            title: "Workers and compaction",
            body: [
              "Pushes run concurrently, so several worker processes add throughput. Every hour the server folds the history that every device already has into snapshots; `accord compact` does it once.",
            ],
          },
        },
      },
      scopes: {
        title: "Scope rules",
        description:
          "Who can read and write which records: how Accord's scopes work, five tested patterns, and the rules that keep them correct.",
        intro:
          "Scopes are your access policy: a record belongs to scope keys computed from its fields, and each user may read and write some keys. A user sees a record when they share a key.",
        sections: {
          how: {
            title: "How scopes work",
            body: [
              "An existing record accepts a write when its current keys overlap the user's write keys; a new record, when the keys it would have after the write do. When a write moves a record, devices that can no longer see it delete it; devices that now can get its whole history.",
            ],
          },
          patterns: {
            title: "Patterns",
            body: [
              "The repository has five patterns with tests: personal, field team, supervisor, multi-tenant and shared lists. Three of them:",
            ],
          },
          rules: {
            title: "Rules that keep scopes correct",
            body: [],
            items: [
              "Fail closed: a record with no keys is visible to nobody.",
              "Keep scope functions pure: no clock, randomness, network or database.",
              "Put the scoping field in the record's first write.",
              "Claims are read on every request: use short token lifetimes to revoke access quickly.",
              "Test scopes like code: one user who should see a record, one who should not.",
            ],
          },
        },
      },
      protocol: {
        title: "Sync protocol",
        description: "Accord's HTTP sync protocol, version 1: push, pull, resync and errors.",
        intro:
          "Clients and the server talk over HTTPS with JSON. Every request carries the user's token and the device id; JSON Schemas for every message are in the repository.",
        sections: {
          push: {
            title: "Push",
            body: [
              "Send the outbox in write order. Acknowledged ops leave the outbox; refused ops, each with a reason, are rolled back on the device. Resending a batch is always safe.",
            ],
          },
          pull: {
            title: "Pull",
            body: [
              "Start from cursor 0, apply every item, store the cursor, and pull again while `has_more` is true. `device_seq` tells the device where its own op numbers are, so an op id is never reused.",
            ],
          },
          resync: {
            title: "Resync",
            body: [
              "When a user's scopes change, the next page brings the records that entered and removes the ones that left. Only a very large change, or a device back after a long absence, gets this answer instead.",
            ],
          },
          errors: {
            title: "Errors",
            body: [],
            items: [
              "`400`: malformed request.",
              "`401`: missing or invalid token.",
              "`403`: the device id belongs to another user.",
              "`429`: rate limit; wait for `Retry-After`.",
              "`500`: server error; retry with backoff (pushes are idempotent).",
            ],
          },
        },
      },
      security: {
        title: "Security",
        description: "What the Accord server enforces, and what to configure when you deploy it.",
        intro:
          "The server enforces authorisation on every push and pull. A few things remain yours to configure when you deploy it.",
        sections: {
          enforced: {
            title: "Enforced by the server",
            body: [],
            items: [
              "Every sync request needs a verified JWT; scopes filter every pull and check every pushed op.",
              "A device id is bound to its first user; a device can only push its own ops.",
              "Re-pushed ops are never applied twice; a reused op id is refused, never silently acknowledged.",
              "Clocks far in the future are refused; the history is append-only, enforced by PostgreSQL.",
              "Request size and rate are limited (413 and 429).",
            ],
          },
          deploy: {
            title: "Your part when deploying",
            body: [],
            items: [
              "Use `jwksUrl` with `issuer` and `audience`, never the development secret.",
              "Terminate TLS in front of Accord.",
              "Restrict CORS to your app's origins.",
              "Back up PostgreSQL and restrict network access to it.",
              "Encrypt sensitive data on devices: Accord does not encrypt local storage.",
            ],
          },
        },
      },
    },
    homeLinks: { code: "Read the client docs", run: "Read the quick start" },
  },

  footer: {
    tagline: "Built for networks that lie.",
    statusLine: "v{version}, released {date}. Pre-1.0.",
    copyright: "© 2026 Ben Hattab",
    linkLabels: {
      github: "GitHub",
      docs: "Docs",
      changelog: "Changelog",
      license: "Licence",
      safeInstall: "safe-install",
      llms: "llms.txt",
    },
  },
};
