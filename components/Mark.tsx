/**
 * The Accord mark, inline so it follows the theme colours via currentColor.
 * Three strokes that start apart and merge into one line — a merge in a git
 * graph; replicas coming to an accord (website.md section 2). The standalone brand
 * files live in public/brand/ (deliverables for app/docs/assets/).
 */
export default function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 40" className={className} aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 6 C 20 6, 24 20, 36 20" />
        <path d="M6 34 C 20 34, 24 20, 36 20" />
        <path d="M36 20 H50" />
      </g>
    </svg>
  );
}
