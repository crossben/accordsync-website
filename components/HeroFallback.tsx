import type { Content } from "@/content/types";

/**
 * Static SVG of the same composition as the three.js scene: three devices
 * around a server, one of them offline (amber dashed link, piled op-packets),
 * the others' state chips settled to the same pattern with the conflict() cell
 * showing both values, amber-marked, on every device. Shown until the scene has
 * loaded, and forever when WebGL is missing, motion is reduced, or Save-Data is
 * on (website.md section 6).
 */
export default function HeroFallback({
  labels,
  hidden,
}: {
  labels: Content["hero"]["scene"]["labels"];
  hidden: boolean;
}) {
  const chip = (x: number, y: number, pattern: boolean[], conflict: "both-kept" | "own-value") => (
    <g key={`${x}-${y}`}>
      {Array.from({ length: 9 }, (_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = x + col * 13;
        const cy = y + row * 13;
        if (i === 4) {
          if (conflict === "both-kept") {
            // the conflict() cell after sync: both values, amber-marked
            return (
              <g key={i}>
                <rect x={cx} y={cy} width={11} height={11} rx={2} fill="var(--conflict)" />
                <circle cx={cx + 3.5} cy={cy + 5.5} r={1.2} fill="var(--ink)" />
                <circle cx={cx + 7.5} cy={cy + 5.5} r={1.2} fill="var(--ink)" />
              </g>
            );
          }
          // the offline device's own local write: one value, not yet synced
          return <rect key={i} x={cx} y={cy} width={11} height={11} rx={2} fill="var(--ink)" />;
        }
        return (
          <rect
            key={i}
            x={cx}
            y={cy}
            width={11}
            height={11}
            rx={2}
            fill={pattern[i] ? "var(--accent)" : "var(--muted)"}
            opacity={pattern[i] ? 1 : 0.35}
          />
        );
      })}
    </g>
  );

  // The settled pattern: cells 0, 2, 6, 8 on (corners), the conflict cell separate.
  const settled = [true, false, true, false, true, false, true, false, true];
  const diverged = [false, false, false, false, true, false, false, false, false];

  return (
    <svg
      viewBox="0 0 560 400"
      className={`h-full w-full transition-opacity duration-700 ${hidden ? "opacity-0" : "opacity-100"}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* ground hint */}
      <ellipse cx="280" cy="215" rx="250" ry="165" fill="var(--line)" opacity="0.3" />

      {/* links */}
      <g fill="none" strokeWidth="2.5">
        <path d="M120 160 Q 200 70 262 190" stroke="var(--muted)" opacity="0.55" />
        <path d="M440 160 Q 360 70 298 190" stroke="var(--conflict)" strokeDasharray="6 5" />
        <path d="M280 330 Q 280 280 280 225" stroke="var(--muted)" opacity="0.55" />
      </g>

      {/* op-packets piled beside the offline device */}
      <g fill="var(--accent)">
        <rect x="474" y="172" width="11" height="11" rx="2" />
        <rect x="487" y="176" width="11" height="11" rx="2" />
        <rect x="478" y="186" width="11" height="11" rx="2" />
        <rect x="492" y="190" width="11" height="11" rx="2" />
      </g>

      {/* server */}
      <rect x="248" y="185" width="64" height="44" rx="8" fill="var(--muted)" />
      <rect x="248" y="172" width="64" height="9" rx="4" fill="var(--accent)" />

      {/* devices */}
      <g>
        <rect x="92" y="158" width="34" height="58" rx="7" fill="var(--ink)" />
        <rect x="423" y="158" width="34" height="58" rx="7" fill="var(--ink)" />
        <rect x="263" y="322" width="34" height="58" rx="7" fill="var(--ink)" />
      </g>

      {/* state chips: the online devices settled to the same pattern, with the
          conflict() cell showing both values, amber-marked; the offline device
          still shows its own diverged edits */}
      {chip(92, 96, settled, "both-kept")}
      {chip(423, 96, settled, "both-kept")}
      {chip(263, 260, diverged, "own-value")}

      {/* labels */}
      <g fontFamily="inherit" fontSize="14" fill="var(--ink)">
        <text x="280" y="252" textAnchor="middle" fill="var(--muted)">
          {labels.server}
        </text>
        <text x="109" y="238" textAnchor="middle">
          {labels.devices[0]}
        </text>
        <text x="440" y="238" textAnchor="middle">
          {labels.devices[1]}
        </text>
        <text x="280" y="400" textAnchor="middle">
          {labels.devices[2]}
        </text>
        <text x="440" y="90" textAnchor="middle" fill="var(--conflict)" fontWeight="600">
          {labels.offline}
        </text>
      </g>
    </svg>
  );
}
