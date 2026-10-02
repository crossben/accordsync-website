// The shared Content type (website.md section 3): every string the site renders lives
// in content/en.ts and content/fr.ts, both typed by this interface, so a
// missing or extra French string fails `npm run typecheck`. No i18n library.
import type { GuaranteeKey, StrategyId } from "@/content/facts";

export type PlannedBadge = {
  /** Visible badge label, e.g. "Planned" / "À venir". */
  label: string;
  /** Screen-reader expansion, e.g. "Planned — not built yet". */
  title: string;
};

export type Content = {
  lang: "en" | "fr";
  /** The other language, for the header switch (keeps the current anchor). */
  otherLang: { label: string; href: string };

  meta: { title: string; description: string };

  header: {
    skipToContent: string;
    homeAria: string;
    nav: {
      problem: string;
      how: string;
      merges: string;
      guarantees: string;
      code: string;
      proof: string;
      run: string;
      openSource: string;
    };
    themeToggle: { toDark: string; toLight: string };
  };

  hero: {
    kicker: string;
    headline: string;
    subline: string;
    ctaHow: string;
    ctaGithub: string;
    /** Required status line (website.md section 4): shown in the hero and the footer. */
    statusLine: string;
    scene: {
      labels: { devices: [string, string, string]; server: string; offline: string };
      /** Screen-reader description of what the illustration shows. */
      description: string;
      pause: string;
      play: string;
      /** Visible caption: it is an illustration, not a live view. */
      caption: string;
    };
  };

  problem: {
    heading: string;
    cards: { title: string; body: string }[];
  };

  how: {
    heading: string;
    intro: string;
    planned: PlannedBadge;
    steps: { title: string; body: string }[];
    timeline: {
      deviceA: string;
      deviceB: string;
      server: string;
      networkDown: string;
      opCounterA: string;
      opCounterB: string;
      opStatusA: string;
      opStatusB: string;
      hlcCounterA: string;
      hlcCounterB: string;
      hlcStatusA: string;
      hlcStatusB: string;
      counterRow: string;
      conflictRow: string;
      finalCounter: string;
      finalConflictA: string;
      finalConflictB: string;
      keptBoth: string;
      converged: string;
    };
  };

  merges: {
    heading: string;
    intro: string;
    planned: PlannedBadge;
    note: string;
    table: {
      columns: { strategy: string; useFor: string; rule: string; example: string };
      rows: Record<StrategyId, { useFor: string; rule: string; before: string; after: string }>;
    };
  };

  guarantees: {
    heading: string;
    intro: string;
    planned: PlannedBadge;
    whyLabel: string;
    /** Label only: the href comes from facts.repo.planProof (facts.ts owns URLs). */
    sourceLink: { label: string };
    items: Record<GuaranteeKey, { title: string; body: string; why: string }>;
  };

  code: {
    heading: string;
    intro: string;
    /** Required while features.snippetsCheckedAgainstApp is false. */
    previewLabel: string;
    tabLabels: { schema: string; offline: string; conflict: string };
    copy: string;
    copied: string;
  };

  /** section 5.9 — rendered only while features.quickstart is true. */
  quickstart: {
    heading: string;
    intro: string;
    steps: { title: string; body: string; commands: string[] }[];
    note: string;
    terminalLabel: string;
    terminalNote: string;
  };

  proof: {
    heading: string;
    intro: string;
    planned: PlannedBadge;
    items: {
      convergenceTest: { title: string; body: string };
      strategyLaws: { title: string; body: string };
      simulator: { title: string; body: string };
    };
  };

  not: {
    heading: string;
    intro: string;
    items: {
      database: { title: string; body: string };
      collab: { title: string; body: string };
      business: { title: string; body: string };
    };
  };

  openSource: {
    heading: string;
    licence: { title: string; body: string };
    contribute: { title: string; body: string };
    security: { title: string; body: string };
    roadmap: { title: string; body: string };
  };

  footer: {
    tagline: string;
    statusLine: string;
    copyright: string;
    linkLabels: { github: string; docs: string; changelog: string; license: string };
  };
};
