"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import CopyButton from "@/components/CopyButton";
import type { Content } from "@/content/types";

gsap.registerPlugin(useGSAP);

export type CodeTab = { id: string; label: string; html: string; raw: string };

/**
 * The "Your code" tabs (website.md section 5.6). All panels are server-rendered
 * (Shiki highlighting happened at build time); this client component only
 * swaps which one is visible and runs the small highlight sweep when a tab
 * opens. ARIA tabs pattern with roving tabindex and arrow keys (section 8).
 */
export default function CodeTabs({
  tabs,
  labels,
}: {
  tabs: CodeTab[];
  labels: Pick<Content["code"], "copy" | "copied">;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = activeIndex === last ? 0 : activeIndex + 1;
    else if (event.key === "ArrowLeft") next = activeIndex === 0 ? last : activeIndex - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setActive(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  // Small highlight sweep when a panel opens — precise and quiet (section 6).
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const root = rootRef.current;
      if (!root) return;
      const panel = root.querySelector(`[data-panel="${active}"]`);
      if (!panel) return;
      gsap.fromTo(
        panel,
        { boxShadow: "inset 0 0 0 1000px rgba(29, 107, 87, 0.10)" },
        { boxShadow: "inset 0 0 0 1000px rgba(29, 107, 87, 0)", duration: 0.6, ease: "power1.out" },
      );
    },
    { dependencies: [active], scope: rootRef },
  );

  return (
    <div ref={rootRef}>
      <div role="tablist" aria-label="Code examples" className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => setActive(tab.id)}
            className={`rounded-full px-4 py-2 font-mono text-sm transition-colors ${
              active === tab.id
                ? "bg-ink text-bg"
                : "border border-line text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          data-panel={tab.id}
          hidden={active !== tab.id}
          className="mt-4"
        >
          <div className="flex justify-end">
            <CopyButton text={tab.raw} label={labels.copy} copiedLabel={labels.copied} />
          </div>
          <div
            className="overflow-x-auto rounded-xl border border-line bg-surface p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: tab.html }}
          />
        </div>
      ))}
    </div>
  );
}
