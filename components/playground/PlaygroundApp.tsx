"use client";

// The demo (showcase.md section 1): two field agents' phones running a small app on the published
// @accordsync/core and @accordsync/simulator. No merge logic lives here: every value on screen is
// read from the real replicas, and the guided steps tick from that same state.
import { useCallback, useEffect, useRef, useState } from "react";
import type { SimDevice, SimServer } from "@accordsync/simulator";
import type { Content } from "@/content/types";
import {
  type DeviceId,
  fieldRead,
  newDevice,
  newServer,
  outcome,
  randomScenario,
  syncRound,
  unsyncedCount,
} from "@/components/playground/Playground";

const RECORD = "dossier:91";
const IDS: DeviceId[] = ["A", "B"];
const DOC = "cni.pdf";

type World = { devices: SimDevice[]; server: SimServer };
type Status = "draft" | "approved" | "rejected";

function createWorld(): World {
  const server = newServer(Date.now);
  const devices = IDS.map((id) => newDevice(id, Date.now));
  const a = devices[0]!;
  a.record(a.writer.assign(RECORD, "client_name", "Aminata Fall"));
  a.record(a.writer.assign(RECORD, "status", "draft"));
  return { devices, server };
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** The status as the app shows it: one value, or every concurrent value of a conflict(). */
function readStatus(d: SimDevice): Status[] {
  const v = fieldRead(d, "status") as
    { value?: unknown; conflicted?: { value: unknown }[] } | undefined;
  if (!v) return [];
  if (v.conflicted) return v.conflicted.map((c) => c.value as Status);
  return v.value === undefined ? [] : [v.value as Status];
}

type Progress = { statusWrites: Set<number>; visitWrites: Set<number>; done: boolean[] };
const freshProgress = (): Progress => ({
  statusWrites: new Set(),
  visitWrites: new Set(),
  done: [false, false, false, false],
});

export default function PlaygroundApp({ t }: { t: Content["playground"] }) {
  const world = useRef<World | null>(null);
  const progress = useRef<Progress>(freshProgress());
  const [, setVersion] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [pulse, setPulse] = useState(false);
  const [faults, setFaults] = useState<{ seed: number; text: string } | null>(null);
  const lastLog = useRef(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  if (!world.current) world.current = createWorld();
  const { devices, server } = world.current;

  // Online phones sync about once a second, like the client's background sync.
  useEffect(() => {
    const tick = () => {
      const w = world.current;
      if (!w) return;
      void syncRound(w.devices, w.server).then(() => {
        if (w.server.log.length !== lastLog.current) {
          lastLog.current = w.server.log.length;
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
        bump();
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bump]);

  // The guided steps tick from the real state; a ticked step stays ticked until "start over".
  const p = progress.current;
  const bOffline = !devices[1]!.online;
  const settled = devices.every(
    (d) => d.online && unsyncedCount(d) === 0 && d.cursor >= server.log.length,
  );
  const result = outcome(devices);
  const conflicted = result.conflicts.some((c) => c.field === "status");
  if (bOffline) p.done[0] = true;
  if (p.done[0] && p.statusWrites.size === 2 && p.visitWrites.size === 2) p.done[1] = true;
  if (p.done[1] && settled && conflicted) p.done[2] = true;
  if (p.done[2] && settled && !conflicted && result.identical) p.done[3] = true;
  const current = p.done.findIndex((d) => !d);

  const write = (i: number, kind: "visit" | "status" | "doc", action: (d: SimDevice) => void) => {
    action(devices[i]!);
    if (p.done[0] && !p.done[1]) {
      if (kind === "visit") p.visitWrites.add(i);
      if (kind === "status") p.statusWrites.add(i);
    }
    bump();
  };

  const toggle = (i: number) => {
    const d = devices[i]!;
    d.online = !d.online;
    setAnnouncement(
      fill(d.online ? t.announce.online : t.announce.offline, { agent: t.agents[i]! }),
    );
    if (d.online) void syncRound(devices, server).then(bump);
    else bump();
  };

  const reset = () => {
    world.current = createWorld();
    progress.current = freshProgress();
    lastLog.current = 0;
    setFaults(null);
    bump();
  };

  const runFaults = (seed: number) => {
    const { result: r } = randomScenario(seed);
    const identical = r.deviceSnapshots.every((s) => s === r.serverSnapshot);
    setFaults({
      seed,
      text: fill(t.faults.result, {
        seed,
        ops: r.ops.length,
        dropped: r.stats.dropped,
        duplicated: r.stats.duplicated,
        partitions: r.stats.partitions,
        verdict: identical ? t.faults.identical : t.faults.diverged,
      }),
    });
  };

  const smallButton =
    "rounded-full border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent";

  return (
    <div>
      <section
        aria-labelledby="pg-steps"
        className="mb-10 rounded-2xl border border-line bg-surface p-5"
      >
        <h3 id="pg-steps" className="font-semibold">
          {t.steps.title}
        </h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.items.map((step, i) => {
            const done = p.done[i];
            const active = i === current;
            return (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                    done
                      ? "border-accent bg-accent text-bg"
                      : active
                        ? "border-accent text-accent"
                        : "border-line text-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={
                    done
                      ? "text-muted line-through decoration-line"
                      : active
                        ? "font-medium"
                        : "text-muted"
                  }
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
        {current === -1 ? <p className="mt-4 font-medium text-accent">{t.steps.allDone}</p> : null}
      </section>

      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Phone t={t} index={0} device={devices[0]!} onToggle={toggle} onWrite={write} />
        <ServerNode t={t} devices={devices} server={server} pulse={pulse} />
        <Phone t={t} index={1} device={devices[1]!} onToggle={toggle} onWrite={write} />
      </div>

      <div className="mt-10">
        <section
          aria-labelledby="pg-faults"
          className="rounded-2xl border border-line bg-surface p-5"
        >
          <h3 id="pg-faults" className="font-semibold">
            {t.faults.title}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={smallButton}
              onClick={() => runFaults(1 + Math.floor(Math.random() * 2_147_483_646))}
            >
              {t.faults.run}
            </button>
            {faults ? (
              <button type="button" className={smallButton} onClick={() => runFaults(faults.seed)}>
                {fill(t.faults.rerun, { seed: faults.seed })}
              </button>
            ) : null}
            <button type="button" className={smallButton} onClick={reset}>
              {t.faults.reset}
            </button>
          </div>
          {faults ? <p className="mt-3 text-sm leading-relaxed text-muted">{faults.text}</p> : null}
        </section>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function SignalIcon({ online }: { online: boolean }) {
  if (!online) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
      </svg>
    );
  }
  return (
    <span aria-hidden="true" className="flex items-end gap-[2px]">
      {[4, 6, 8, 10].map((h) => (
        <span key={h} className="w-[3px] rounded-sm bg-current" style={{ height: h }} />
      ))}
    </span>
  );
}

function Phone({
  t,
  index,
  device,
  onToggle,
  onWrite,
}: {
  t: Content["playground"];
  index: number;
  device: SimDevice;
  onToggle: (i: number) => void;
  onWrite: (i: number, kind: "visit" | "status" | "doc", action: (d: SimDevice) => void) => void;
}) {
  const agent = t.agents[index]!;
  const online = device.online;
  const pending = unsyncedCount(device);
  const visits = Number(fieldRead(device, "visits") ?? 0);
  const docs = (fieldRead(device, "documents") as string[] | undefined) ?? [];
  const hasDoc = docs.includes(DOC);
  const status = readStatus(device);
  const conflict = status.length > 1;
  const label = (s: Status) => t.app.statuses[s] ?? s;
  const assign = (s: Status) =>
    onWrite(index, "status", (d) => d.record(d.writer.assign(RECORD, "status", s)));

  return (
    <div className="mx-auto flex flex-col items-center gap-4">
      {/* The phone */}
      <section
        aria-label={`${agent} — ${t.app.name}`}
        className="relative w-[290px] rounded-[46px] border-[10px] border-ink bg-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
      >
        <div className="relative h-[560px] overflow-hidden rounded-[36px] bg-bg">
          {/* notch */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-ink"
          />
          {/* status bar */}
          <div
            className={`flex items-center justify-between px-6 pt-3 text-[11px] font-semibold ${online ? "text-ink" : "text-conflict"}`}
          >
            <span>9:41</span>
            <SignalIcon online={online} />
          </div>

          {/* app bar */}
          <div className="mt-4 flex items-center justify-between bg-accent px-4 py-3 text-bg">
            <div>
              <p className="text-[11px] uppercase tracking-wider opacity-80">{t.app.name}</p>
              <p className="text-sm font-semibold">{agent}</p>
            </div>
            <span className="rounded-full bg-bg/20 px-2.5 py-1 text-[11px] font-semibold">
              {pending > 0 ? fill(t.app.pending, { n: pending }) : t.app.synced}
            </span>
          </div>
          {!online ? (
            <p className="bg-conflict/15 px-4 py-1.5 text-[11px] font-medium text-conflict">
              ✈ {t.app.offline}
            </p>
          ) : null}

          <div className="space-y-3 p-4">
            {/* client */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent"
              >
                AF
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{t.app.client}</p>
                <p className="text-[11px] text-muted">{t.app.dossier}</p>
              </div>
            </div>

            {/* visits */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5">
              <div>
                <p className="text-[11px] text-muted">{t.app.visits}</p>
                <p className="font-mono text-2xl font-bold leading-none">{visits}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onWrite(index, "visit", (d) => d.record(d.writer.inc(RECORD, "visits", 1)))
                }
                className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg hover:opacity-90"
              >
                {t.app.addVisit}
              </button>
            </div>

            {/* documents */}
            <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
              <p className="text-[11px] text-muted">{t.app.documents}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {hasDoc ? (
                  <button
                    type="button"
                    onClick={() =>
                      onWrite(index, "doc", (d) =>
                        d.record(d.writer.remove(RECORD, "documents", DOC)),
                      )
                    }
                    className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent"
                  >
                    🪪 {DOC} ✕
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onWrite(index, "doc", (d) => d.record(d.writer.add(RECORD, "documents", DOC)))
                    }
                    className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-accent"
                  >
                    {t.app.addDoc}
                  </button>
                )}
              </div>
            </div>

            {/* decision */}
            {conflict ? (
              <div
                role="alert"
                className="rounded-xl border-2 border-conflict bg-conflict/10 px-3 py-2.5"
              >
                <p className="text-xs font-bold text-conflict">⚠ {t.app.conflictTitle}</p>
                <p className="mt-0.5 text-[11px] text-ink">{t.app.conflictBody}</p>
                <div className="mt-2 grid gap-1.5">
                  {status.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => assign(s)}
                      className="rounded-lg border border-conflict bg-surface px-2 py-1.5 text-xs font-semibold text-conflict hover:bg-conflict hover:text-bg"
                    >
                      {fill(t.app.keep, { value: label(s) })}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
                <p className="text-[11px] text-muted">
                  {t.app.status}:{" "}
                  <span className="font-semibold text-ink">
                    {status[0] ? label(status[0]) : "—"}
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    aria-pressed={status[0] === "approved"}
                    onClick={() => assign("approved")}
                    className="rounded-lg border border-line px-2 py-1.5 text-xs font-semibold hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-bg"
                  >
                    {t.app.approve}
                  </button>
                  <button
                    type="button"
                    aria-pressed={status[0] === "rejected"}
                    onClick={() => assign("rejected")}
                    className="rounded-lg border border-line px-2 py-1.5 text-xs font-semibold hover:border-conflict aria-pressed:border-conflict aria-pressed:bg-conflict aria-pressed:text-bg"
                  >
                    {t.app.reject}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Airplane mode, under the phone */}
      <button
        type="button"
        role="switch"
        aria-checked={!online}
        onClick={() => onToggle(index)}
        className="flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium"
      >
        <span
          className={`relative h-6 w-11 rounded-full transition-colors ${online ? "bg-line" : "bg-conflict"}`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-surface shadow transition-all ${online ? "left-1" : "left-6"}`}
          />
        </span>
        ✈ {t.airplane} · {agent}
      </button>
    </div>
  );
}

function ServerNode({
  t,
  devices,
  server,
  pulse,
}: {
  t: Content["playground"];
  devices: SimDevice[];
  server: SimServer;
  pulse: boolean;
}) {
  const line = (online: boolean) =>
    `h-0 w-full border-t-4 lg:w-16 ${online ? "border-accent" : "border-dashed border-conflict/60"}`;
  return (
    <div className="flex items-center justify-center gap-0 lg:flex-row">
      <span aria-hidden="true" className={`hidden lg:block ${line(devices[0]!.online)}`} />
      <div
        className={`flex flex-col items-center rounded-2xl border-2 bg-surface px-4 py-3 transition-colors motion-safe:duration-300 ${
          pulse ? "border-accent" : "border-line"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-7 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="4" y="3" width="16" height="7" rx="1.5" />
          <rect x="4" y="14" width="16" height="7" rx="1.5" />
          <path d="M8 6.5h.01M8 17.5h.01" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="mt-1 text-sm font-semibold">{t.server.title}</p>
        <p className="font-mono text-xs text-muted">
          {fill(t.server.stored, { n: server.log.length })}
        </p>
      </div>
      <span aria-hidden="true" className={`hidden lg:block ${line(devices[1]!.online)}`} />
    </div>
  );
}
