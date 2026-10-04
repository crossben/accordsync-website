"use client";

// The playground (showcase.md section 1): three devices and a server running the published
// @accordsync/core and @accordsync/simulator in the browser. No merge logic lives here: every
// state shown is read from the real replicas, and the outcome line is computed from them.
import { useCallback, useEffect, useRef, useState } from "react";
import type { SimDevice, SimServer } from "@accordsync/simulator";
import type { Content } from "@/content/types";
import {
  type DeviceId,
  fieldLabel,
  fieldRead,
  newDevice,
  newServer,
  outcome,
  randomScenario,
  syncRound,
  unsyncedCount,
} from "@/components/playground/Playground";

const RECORD = "dossier:91";
const IDS: DeviceId[] = ["A", "B", "C"];
const NAMES = ["Awa Ndiaye", "Aminata Fall", "Moussa Diop", "Fatou Sow"];

type World = { devices: SimDevice[]; server: SimServer };

function createWorld(): World {
  const server = newServer(Date.now);
  const devices = IDS.map((id) => newDevice(id, Date.now));
  // A starting dossier, written by device A and synced to everyone.
  const a = devices[0]!;
  a.record(a.writer.assign(RECORD, "client_name", NAMES[0]!));
  a.record(a.writer.assign(RECORD, "status", "draft"));
  return { devices, server };
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

export default function PlaygroundApp({ t }: { t: Content["playground"] }) {
  const world = useRef<World | null>(null);
  const [, setVersion] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [faults, setFaults] = useState<{ seed: number; text: string } | null>(null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  if (!world.current) world.current = createWorld();
  const { devices, server } = world.current;

  // Online devices sync about once a second, like a client's background sync.
  useEffect(() => {
    const tick = () => {
      const w = world.current;
      if (!w) return;
      void syncRound(w.devices, w.server).then(bump);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bump]);

  const write = (d: SimDevice, action: (d: SimDevice) => void) => {
    action(d);
    bump();
  };

  const toggle = (d: SimDevice, label: string) => {
    d.online = !d.online;
    setAnnouncement(fill(d.online ? t.announce.online : t.announce.offline, { device: label }));
    if (d.online) void syncRound(devices, server).then(bump);
    else bump();
  };

  const reset = () => {
    world.current = createWorld();
    setFaults(null);
    bump();
  };

  const runFaults = (seed: number) => {
    const { result } = randomScenario(seed);
    const identical = result.deviceSnapshots.every((s) => s === result.serverSnapshot);
    setFaults({
      seed,
      text: fill(t.faults.result, {
        seed,
        ops: result.ops.length,
        dropped: result.stats.dropped,
        duplicated: result.stats.duplicated,
        partitions: result.stats.partitions,
        verdict: identical ? t.outcome.identical : t.faults.diverged,
      }),
    });
  };

  const settled = devices.every(
    (d) => d.online && unsyncedCount(d) === 0 && d.cursor >= server.log.length,
  );
  const result = outcome(devices);
  const conflict = result.conflicts.find((c) => c.field === "status");

  const button =
    "rounded-full border border-line px-3 py-1 text-xs font-medium transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {devices.map((d, i) => {
          const label = `${t.device} ${IDS[i]}`;
          const status = fieldRead(d, "status");
          const docs = fieldRead(d, "documents");
          const hasDoc = Array.isArray(docs) && docs.includes("cni.pdf");
          return (
            <section
              key={IDS[i]}
              aria-label={label}
              className={`rounded-xl border bg-surface p-4 ${d.online ? "border-line" : "border-conflict"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{label}</h3>
                <button
                  type="button"
                  onClick={() => toggle(d, label)}
                  aria-pressed={!d.online}
                  className={`${button} ${d.online ? "text-accent" : "text-conflict"}`}
                >
                  {d.online ? `● ${t.online}` : `✈ ${t.offline}`}
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">{t.fields.name}</dt>
                <dd>{fieldLabel("client_name", fieldRead(d, "client_name")) || t.none}</dd>
                <dt className="text-muted">{t.fields.visits}</dt>
                <dd className="font-mono">{fieldLabel("visits", fieldRead(d, "visits"))}</dd>
                <dt className="text-muted">{t.fields.documents}</dt>
                <dd>{fieldLabel("documents", docs) || t.none}</dd>
                <dt className="text-muted">{t.fields.status}</dt>
                <dd
                  className={
                    typeof status === "object" && status && "conflicted" in status
                      ? "font-medium text-conflict"
                      : ""
                  }
                >
                  {fieldLabel("status", status) || t.none}
                </dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={button}
                  onClick={() => write(d, (x) => x.record(x.writer.inc(RECORD, "visits", 1)))}
                >
                  {t.actions.visit}
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    write(d, (x) =>
                      x.record(
                        x.writer.assign(
                          RECORD,
                          "client_name",
                          NAMES[(x.writer.seq + i) % NAMES.length]!,
                        ),
                      ),
                    )
                  }
                >
                  {t.actions.rename}
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    write(d, (x) =>
                      x.record(
                        hasDoc
                          ? x.writer.remove(RECORD, "documents", "cni.pdf")
                          : x.writer.add(RECORD, "documents", "cni.pdf"),
                      ),
                    )
                  }
                >
                  {hasDoc ? t.actions.removeDoc : t.actions.addDoc}
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    write(d, (x) => x.record(x.writer.assign(RECORD, "status", "approved")))
                  }
                >
                  {t.actions.approve}
                </button>
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    write(d, (x) => x.record(x.writer.assign(RECORD, "status", "rejected")))
                  }
                >
                  {t.actions.reject}
                </button>
              </div>
              <p className="mt-3 font-mono text-xs text-muted">
                {fill(t.unsynced, { n: unsyncedCount(d) })}
              </p>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-muted">
        <span className="font-medium text-ink">{t.server}:</span>{" "}
        {fill(t.opsOnServer, { n: server.log.length })}
      </p>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
        {!settled ? (
          <p>{t.outcome.waiting}</p>
        ) : conflict ? (
          <div>
            <p className="font-medium text-conflict">
              {fill(t.outcome.conflicted, { values: conflict.values.join(" | ") })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conflict.values.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={button}
                  onClick={() =>
                    write(devices[0]!, (x) => x.record(x.writer.assign(RECORD, "status", v)))
                  }
                >
                  {fill(t.actions.keep, { value: v })}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="font-medium text-accent">
            {result.identical ? t.outcome.identical : t.outcome.waiting}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          onClick={() => runFaults(1 + Math.floor(Math.random() * 2_147_483_646))}
        >
          {t.faults.run}
        </button>
        {faults ? (
          <button type="button" className={button} onClick={() => runFaults(faults.seed)}>
            {fill(t.faults.rerun, { seed: faults.seed })}
          </button>
        ) : null}
        <button type="button" className={button} onClick={reset}>
          {t.faults.reset}
        </button>
      </div>
      {faults ? <p className="mt-3 max-w-3xl text-sm leading-relaxed">{faults.text}</p> : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
