"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { Content } from "@/content/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Timeline = Content["how"]["timeline"];

/**
 * The signature visual (website.md section 6): two device lanes and a server lane.
 * Ops appear as dots with their HLC label, a "network down" band covers part of
 * the timeline, then the ops cross to the server and back in arbitrary order,
 * and the final states line up — a counter row shows 3 + 2 = 5 on every lane,
 * a conflict() row shows both values kept.
 *
 * The SVG is server-rendered in its FINAL state: with JavaScript disabled, and
 * for prefers-reduced-motion users, that is exactly what shows. GSAP scrubs
 * from that state through the sync story as the section scrolls. No pinning,
 * no layout shift: fixed viewBox, transforms only.
 */

// Each op: origin on its lane, then waypoints to the server and out to the
// other device. The staggered starts make the arrival order arbitrary — the
// point of the diagram. The two ops per lane approach the server on different
// junctions (505 / 555) so their labels never collide mid-scrub.
const OPS = [
  {
    id: "a1",
    x: 215,
    y: 110,
    starts: 1.0,
    to: [
      [505, 110],
      [505, 240],
      [612, 240],
      [612, 370],
    ],
  },
  {
    id: "b1",
    x: 268,
    y: 370,
    starts: 1.25,
    to: [
      [505, 370],
      [505, 240],
      [612, 240],
      [612, 110],
    ],
  },
  {
    id: "a2",
    x: 322,
    y: 110,
    starts: 1.7,
    to: [
      [555, 110],
      [555, 240],
      [640, 240],
      [640, 370],
    ],
  },
  {
    id: "b2",
    x: 375,
    y: 370,
    starts: 1.95,
    to: [
      [555, 370],
      [555, 240],
      [640, 240],
      [640, 110],
    ],
  },
] as const;

export default function SyncTimeline({ t }: { t: Timeline }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const root = rootRef.current;
      if (!root) return;

      const ops = OPS.map(({ id }) => root.querySelector(`[data-op="${id}"]`));
      const band = root.querySelector("[data-band]");
      const chips = root.querySelectorAll("[data-chip]");
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root, start: "top 80%", end: "+=520", scrub: 1 },
      });

      // from the static final state back to the start of the story, then scrub
      tl.set(ops, { opacity: 1, x: 0, y: 0 }, 0);
      tl.fromTo(
        ops,
        { opacity: 0, scale: 0.5, transformOrigin: "center" },
        { opacity: 1, scale: 1, duration: 0.35, stagger: 0.08, ease: "power1.out" },
        0,
      );
      if (band) tl.fromTo(band, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);

      OPS.forEach(({ id, x, y, to, starts }, i) => {
        const el = ops[i];
        if (!el) return;
        const keyframes = to.map(([tx, ty], j) => ({
          x: tx - x,
          y: ty - y,
          duration: j === 0 ? 0.28 : j === 1 ? 0.2 : j === 2 ? 0.26 : 0.2,
        }));
        tl.to(el, { keyframes }, starts);
        void id;
      });

      tl.to(ops, { opacity: 0, duration: 0.25 }, 2.95);
      tl.to(band, { opacity: 0, duration: 0.4 }, 3.0);
      tl.fromTo(
        chips,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: "power1.out" },
        3.05,
      );
    },
    { scope: rootRef },
  );

  const lanes = [
    { y: 110, label: t.deviceA },
    { y: 240, label: t.server },
    { y: 370, label: t.deviceB },
  ];
  const chip = (y: number) => (
    <g data-chip="" key={y} opacity="0">
      <rect
        x={648}
        y={y - 31}
        width={142}
        height={62}
        rx={10}
        fill="var(--surface)"
        stroke="var(--line)"
      />
      <text x={656} y={y - 16} fontSize={9} fill="var(--muted)" letterSpacing="0.04em">
        {t.counterRow.toUpperCase()}
      </text>
      <text
        x={656}
        y={y - 1}
        fontSize={13}
        fill="var(--accent)"
        fontWeight={600}
        fontFamily="var(--font-mono), monospace"
      >
        {t.finalCounter}
      </text>
      <text x={656} y={y + 15} fontSize={9} fill="var(--muted)" letterSpacing="0.04em">
        {t.conflictRow.toUpperCase()}
      </text>
      <rect x={656} y={y + 21} width={8} height={8} rx={2} fill="var(--conflict)" />
      <text
        x={670}
        y={y + 29}
        fontSize={9.5}
        fill="var(--ink)"
        fontFamily="var(--font-mono), monospace"
      >
        {t.finalConflictA} | {t.finalConflictB}
      </text>
    </g>
  );

  const opLabel = (id: string) => {
    switch (id) {
      case "a1":
        return { main: t.opCounterA, hlc: t.hlcCounterA };
      case "a2":
        return { main: t.opStatusA, hlc: t.hlcStatusA };
      case "b1":
        return { main: t.opCounterB, hlc: t.hlcCounterB };
      default:
        return { main: t.opStatusB, hlc: t.hlcStatusB };
    }
  };

  return (
    <div ref={rootRef} className="overflow-x-auto">
      <svg
        viewBox="0 0 800 470"
        width={800}
        height={470}
        className="h-auto w-full min-w-[660px]"
        role="img"
        aria-label={`${t.deviceA}, ${t.server}, ${t.deviceB}: ${t.converged}`}
      >
        {/* network-down band */}
        <g data-band="" opacity="0">
          <rect x={250} y={62} width={192} height={348} fill="var(--conflict)" opacity={0.08} />
          <rect
            x={250}
            y={62}
            width={192}
            height={348}
            fill="none"
            stroke="var(--conflict)"
            strokeDasharray="6 6"
            opacity={0.6}
          />
          <text
            x={346}
            y={82}
            textAnchor="middle"
            fontSize={12}
            fill="var(--conflict)"
            fontWeight={600}
          >
            {t.networkDown}
          </text>
        </g>

        {/* lanes */}
        {lanes.map(({ y, label }) => (
          <g key={y}>
            <text x={150} y={y + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
              {label}
            </text>
            <line x1={165} y1={y} x2={620} y2={y} stroke="var(--line)" strokeWidth={2} />
            <line
              x1={620}
              y1={y}
              x2={648}
              y2={y}
              stroke="var(--line)"
              strokeWidth={2}
              strokeDasharray="2 5"
            />
          </g>
        ))}

        {/* the server applies the ops it receives */}
        <rect
          x={512}
          y={228}
          width={36}
          height={24}
          rx={6}
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />

        {/* ops: final state has them absorbed into the replicas (opacity 0) */}
        {OPS.map(({ id, x, y }) => {
          const { main, hlc } = opLabel(id);
          return (
            <g key={id} data-op={id} transform={`translate(${x},${y})`} opacity="0">
              <circle r={7} fill="var(--accent)" />
              <text y={-16} textAnchor="middle" fontSize={12} fill="var(--ink)">
                {main}
              </text>
              <text
                y={24}
                textAnchor="middle"
                fontSize={9}
                fill="var(--muted)"
                fontFamily="var(--font-mono), monospace"
              >
                {hlc}
              </text>
            </g>
          );
        })}

        {/* final states, identical on every lane */}
        {lanes.map(({ y }) => chip(y))}

        {/* legend */}
        <g transform="translate(0,448)">
          <circle cx={168} cy={-4} r={5} fill="var(--accent)" />
          <text x={180} fontSize={12} fill="var(--muted)">
            {t.converged}
          </text>
          <rect x={560} y={-9} width={9} height={9} rx={2} fill="var(--conflict)" />
          <text x={576} fontSize={12} fill="var(--muted)">
            {t.keptBoth}
          </text>
        </g>
      </svg>
    </div>
  );
}
