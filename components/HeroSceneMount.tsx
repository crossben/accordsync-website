"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Content } from "@/content/types";
import HeroFallback from "@/components/HeroFallback";

// three.js forms its own chunk, loaded only when the page is idle
// (website.md section 6, section 8). Never the LCP: the fallback SVG is already there.
const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

type IdleHandle = number;

function onIdle(cb: () => void): IdleHandle {
  const w = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
  // Extra headroom after load: the scene is decoration and must not fight the
  // page for main-thread time while it is becoming interactive (section 8).
  return window.setTimeout(() => {
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 3000 });
    else cb();
  }, 1500) as unknown as IdleHandle;
}
function cancelIdle(handle: IdleHandle) {
  const w = window as Window & typeof globalThis & { cancelIdleCallback?: (h: number) => void };
  if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

export default function HeroSceneMount({ scene }: { scene: Content["hero"]["scene"] }) {
  const [allowed, setAllowed] = useState<boolean | null>(null); // null: still deciding
  const [idleDone, setIdleDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true;
    let webgl = false;
    try {
      const probe = document.createElement("canvas");
      webgl = !!(probe.getContext("webgl2") ?? probe.getContext("webgl"));
    } catch {
      webgl = false;
    }
    if (reduced || saveData || !webgl) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    let cancelled = false;
    let handle: IdleHandle | undefined;
    const startIdle = () => {
      if (!cancelled) handle = onIdle(() => setIdleDone(true));
    };
    // Only once the window has fully loaded: the scene is decorative and must
    // never compete with the hero text for the main thread (LCP/TBT, section 8).
    if (document.readyState === "complete") startIdle();
    else window.addEventListener("load", startIdle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", startIdle);
      if (handle !== undefined) cancelIdle(handle);
    };
  }, []);

  return (
    <>
      {/* The static SVG is the fallback and the loading state; the scene fades in over it. */}
      <div ref={hostRef} className="absolute inset-0">
        <HeroFallback labels={scene.labels} hidden={allowed === true && ready} />
      </div>

      {allowed === true && idleDone && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <HeroScene onReady={() => setReady(true)} paused={paused} labels={scene.labels} />
        </div>
      )}

      {/* Pause button (WCAG 2.2.2): the scene moves for more than 5 s, so it must be pausable. */}
      {allowed === true && idleDone && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="absolute right-0 top-0 z-10 grid size-9 place-items-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {paused ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          )}
          <span className="sr-only">{paused ? scene.play : scene.pause}</span>
        </button>
      )}
    </>
  );
}
