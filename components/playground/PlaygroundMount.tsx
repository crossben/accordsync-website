"use client";

// Loads the playground only when its section scrolls into view: the simulator never weighs on the
// rest of the page (website.md section 8).
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Content } from "@/content/types";

const PlaygroundApp = dynamic(() => import("@/components/playground/PlaygroundApp"), {
  ssr: false,
});

export default function PlaygroundMount({ t }: { t: Content["playground"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="min-h-[24rem]">
      {visible ? <PlaygroundApp t={t} /> : <p className="text-sm text-muted">{t.loading}</p>}
    </div>
  );
}
