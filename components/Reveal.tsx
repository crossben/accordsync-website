"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Fades and slides its children up 12 px, once, when they enter the viewport
 * (website.md section 6 "Reveals"). With prefers-reduced-motion nothing moves: the
 * content simply stays where it is. Without JavaScript the content is
 * server-rendered and visible.
 */
export default function Reveal({
  children,
  className,
  stagger,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Stagger direct children instead of animating the wrapper itself. */
  stagger?: boolean;
  as?: "div" | "ul" | "ol";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const targets = stagger ? ref.current?.children : ref.current;
      if (!targets) return;
      gsap.from(targets, {
        y: 12,
        opacity: 0,
        duration: 0.5,
        ease: "power1.out",
        stagger: stagger ? 0.08 : 0,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
