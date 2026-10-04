"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";
import { useGSAP } from "@gsap/react";
import type { Content } from "@/content/types";

gsap.registerPlugin(ScrollTrigger, TextPlugin, useGSAP);

/**
 * The quick-start terminal (website.md section 6, section 5.9): the commands type themselves,
 * then the real output appears: what the scaffolded example client prints after
 * it syncs (facts.quickstartOutput). The real, copyable commands sit next to this
 * block in the section. Plays once; with prefers-reduced-motion, and without
 * JavaScript, the full text is simply there (the markup is authored complete).
 */

export default function Terminal({
  label,
  commands,
  output,
}: {
  label: Content["quickstart"]["terminalLabel"];
  commands: string[];
  /** The real last line of output, from the facts sheet (guarded by check-facts). */
  output: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const root = rootRef.current;
      if (!root) return;
      const cmdEls = root.querySelectorAll<HTMLElement>("[data-cmd]");
      const out = root.querySelector("[data-out]");

      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 80%", once: true },
      });
      cmdEls.forEach((el, i) => {
        const text = el.dataset.cmd ?? "";
        tl.fromTo(
          el,
          { text: { value: "" } },
          { text: { value: text }, duration: Math.max(text.length * 0.028, 0.3), ease: "none" },
          i * 0.55,
        );
      });
      if (out) {
        tl.fromTo(
          out,
          { opacity: 0, y: 4 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power1.out" },
          cmdEls.length * 0.55 + 0.25,
        );
      }
    },
    { scope: rootRef },
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
        </span>
        <span className="font-mono text-xs text-muted">{label}</span>
      </div>
      <div className="min-h-[9.5rem] px-4 py-3 font-mono text-sm leading-relaxed">
        {commands.map((cmd) => (
          <p key={cmd} className="whitespace-pre-wrap break-all">
            <span aria-hidden="true" className="mr-2 text-accent">
              $
            </span>
            <span data-cmd={cmd}>{cmd}</span>
          </p>
        ))}
        <p data-out="" className="mt-1 whitespace-pre-wrap break-all">
          {output}
        </p>
      </div>
    </div>
  );
}
