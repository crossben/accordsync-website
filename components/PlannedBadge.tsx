import type { Content } from "@/content/types";

/**
 * The *Planned* badge (website.md section 4): a designed fact must never read as a
 * working one, so every designed-only section carries this next to its heading.
 * The label text carries the meaning — colour never does (section 2).
 */
export default function PlannedBadge({ planned }: { planned: Planned }) {
  return (
    <span
      title={planned.title}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 align-middle text-xs font-medium text-muted"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-muted" />
      {planned.label}
    </span>
  );
}

export type Planned = Content["how"]["planned"];
