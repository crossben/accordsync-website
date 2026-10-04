"use client";

import { useEffect, useRef, useState } from "react";
import { conflict, counter, defineSchema, lww, set, type Op, type Schema } from "@accordsync/core";
import {
  SimDevice,
  SimServer,
  createRng,
  type Rng,
  type SimConfig,
  simulate,
} from "@accordsync/simulator";
import type { Content } from "@/content/types";

export const PLAYGROUND_SCHEMA: Schema = defineSchema({
  dossier: {
    client_name: lww(),
    documents: set(),
    visits: counter(),
    status: conflict(),
  },
});

const RECORD = "dossier:91";
export type DeviceId = "A" | "B" | "C";

export function newDevice(id: DeviceId, now: () => number): SimDevice {
  return new SimDevice(`d${id.toLowerCase()}`, PLAYGROUND_SCHEMA, now, {
    batchSize: 4,
    pageSize: 6,
    timeoutMs: 2_000,
    maxSkewMs: 24 * 3_600_000,
  });
}

export function newServer(now: () => number): SimServer {
  return new SimServer(PLAYGROUND_SCHEMA, 24 * 3_600_000, () => undefined);
}

export async function syncRound(devices: SimDevice[], server: SimServer): Promise<void> {
  const now = Date.now();
  for (const d of devices) {
    if (!d.online) continue;
    const queue: ReturnType<typeof d.tick> = [...d.tick(now)];
    while (queue.length > 0) {
      const req = queue.shift()!;
      const res = req.type === "push" ? server.push(req, now) : server.pull(req);
      for (const r of d.handle(res, now)) queue.push(r);
    }
  }
}

/** A `conflict()` field holding several values, as `replica.read` returns it. */
type Conflicted = { conflicted: { value: unknown; opId: string }[] };
function isConflicted(value: unknown): value is Conflicted {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { conflicted?: unknown }).conflicted)
  );
}

export function outcome(devices: SimDevice[]): {
  identical: boolean;
  conflicts: { field: string; values: string[] }[];
} {
  const snaps = devices.map((d) => d.writer.replica.snapshot());
  const identical = snaps.every((s) => s === snaps[0]);
  const conflicts: { field: string; values: string[] }[] = [];
  for (const d of devices) {
    const read = d.writer.replica.read(RECORD);
    if (!read) continue;
    for (const [field, value] of Object.entries(read)) {
      if (isConflicted(value)) {
        const existing = conflicts.find((c) => c.field === field);
        const vals = value.conflicted.map((v) => String(v.value));
        if (existing) existing.values = [...new Set([...existing.values, ...vals])];
        else conflicts.push({ field, values: vals });
      }
    }
  }
  return { identical, conflicts };
}

export function randomScenario(seed: number): {
  config: SimConfig;
  result: ReturnType<typeof simulate>;
} {
  const rng = createRng(seed);
  const config: SimConfig = {
    seed,
    devices: 3,
    durationMs: 40_000,
    writeEveryMs: 1_200,
    syncEveryMs: 1_500,
    timeoutMs: 2_000,
    batchSize: 4,
    pageSize: 6,
    dropRate: rng.next() < 0.25 ? 0.3 : 0.1,
    duplicateRate: 0.1,
    minDelayMs: 5,
    maxDelayMs: 1_800,
    partitionRate: 0.08,
    maxPartitionMs: 15_000,
    maxClockErrorMs: 3_600_000,
    maxSkewMs: 24 * 3_600_000,
  };
  // The simulator's random writes target its own schema (SIM_SCHEMA): use it, not the cards' one.
  return { config, result: simulate(config) };
}

export function unsyncedCount(d: SimDevice): number {
  return d.outbox.length;
}

export function refusedCount(d: SimDevice): number {
  return d.refused.length;
}

export function fieldRead(d: SimDevice, field: string): unknown {
  return d.writer.replica.read(RECORD)?.[field];
}

export function fieldLabel(field: string, value: unknown): string {
  if (field === "visits") return String(value ?? 0);
  if (field === "documents") return Array.isArray(value) ? value.join(", ") : "";
  if (isConflicted(value)) {
    return value.conflicted.map((v) => String(v.value)).join(" | ");
  }
  // A conflict() field with a single value reads as { value }.
  if (typeof value === "object" && value !== null && "value" in value) {
    return String((value as { value: unknown }).value ?? "");
  }
  return String(value ?? "");
}

export function nextSeed(rng: Rng): number {
  return rng.int(1, 2 ** 31 - 1);
}

export type { Op };
