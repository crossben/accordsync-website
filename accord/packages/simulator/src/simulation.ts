import {
  conflict,
  counter,
  defineSchema,
  type Op,
  Replica,
  type Schema,
  lww,
  set,
} from '@accordsync/core';
import { SimDevice } from './device';
import type { Request, Response } from './protocol';
import { createRng, type Rng } from './rng';
import { SimServer } from './server';

export interface SimConfig {
  seed: number;
  devices: number;
  /** Virtual length of the chaotic phase, in ms. */
  durationMs: number;
  /** Mean time between writes on one device. */
  writeEveryMs: number;
  syncEveryMs: number;
  timeoutMs: number;
  batchSize: number;
  pageSize: number;
  /** Network faults, applied to every message during the chaotic phase. */
  dropRate: number;
  duplicateRate: number;
  minDelayMs: number;
  maxDelayMs: number;
  /** Chance per sync tick that an online device goes offline (a partition) for a while. */
  partitionRate: number;
  maxPartitionMs: number;
  /** Per-device clock error bound: phones are wrong by up to this much, either way. */
  maxClockErrorMs: number;
  maxSkewMs: number;
  /** When set, the server refuses writes from device d0 to `dossier:2` (a read-only record for it). */
  restrictD0?: boolean;
}

export const DEFAULT_CONFIG: Omit<SimConfig, 'seed'> = {
  devices: 3,
  durationMs: 60_000,
  writeEveryMs: 1_500,
  syncEveryMs: 2_000,
  timeoutMs: 3_000,
  batchSize: 5,
  pageSize: 7,
  dropRate: 0.2,
  duplicateRate: 0.1,
  minDelayMs: 10,
  maxDelayMs: 2_500,
  partitionRate: 0.05,
  maxPartitionMs: 20_000,
  maxClockErrorMs: 3_600_000,
  maxSkewMs: 24 * 3_600_000,
};

export const SIM_SCHEMA = defineSchema({
  dossier: { name: lww(), docs: set(), visits: counter(), status: conflict() },
});

export interface SimResult {
  seed: number;
  /** Canonical state of every device, then the server. */
  deviceSnapshots: string[];
  serverSnapshot: string;
  /** Every op any device wrote. */
  ops: Op[];
  /** Ops the server accepted: what every replica must converge to. */
  accepted: Op[];
  refused: number;
  /** Virtual time at which every replica had every op. */
  quiescedAt: number;
  stats: { messages: number; dropped: number; duplicated: number; partitions: number };
  /** One line per event, for exact replay comparison and debugging a failing seed. */
  trace: string[];
}

type Event =
  | { kind: 'write'; device: number }
  | { kind: 'tick'; device: number }
  | { kind: 'reconnect'; device: number }
  | { kind: 'to-server'; device: number; req: Request }
  | { kind: 'to-device'; device: number; res: Response };

const START = 1_700_000_000_000;
const MAX_EVENTS = 2_000_000;

/** Runs one seeded simulation. The same config always produces the same trace. */
export function simulate(config: SimConfig, schema: Schema = SIM_SCHEMA): SimResult {
  const rng = createRng(config.seed);
  let now = START;
  const queue = new EventQueue();
  const server = new SimServer(schema, config.maxSkewMs, (op) =>
    config.restrictD0 && op.hlc.node === 'd0' && op.record === 'dossier:2'
      ? 'd0 may not write dossier:2'
      : undefined,
  );
  const errors = Array.from({ length: config.devices }, () =>
    rng.int(-config.maxClockErrorMs, config.maxClockErrorMs),
  );
  const devices = errors.map(
    (err, i) =>
      new SimDevice(`d${i}`, schema, () => now + err, {
        batchSize: config.batchSize,
        pageSize: config.pageSize,
        timeoutMs: config.timeoutMs,
        maxSkewMs: config.maxSkewMs,
      }),
  );
  const ops: Op[] = [];
  const trace: string[] = [];
  const stats = { messages: 0, dropped: 0, duplicated: 0, partitions: 0 };
  let healed = false;
  const end = START + config.durationMs;

  const send = (e: Extract<Event, { kind: 'to-server' | 'to-device' }>) => {
    stats.messages++;
    if (!healed && rng.next() < config.dropRate) {
      stats.dropped++;
      return;
    }
    const copies = !healed && rng.next() < config.duplicateRate ? 2 : 1;
    if (copies === 2) stats.duplicated++;
    for (let c = 0; c < copies; c++) {
      queue.push(now + rng.int(config.minDelayMs, config.maxDelayMs), e);
    }
  };

  for (let i = 0; i < devices.length; i++) {
    queue.push(now + rng.int(0, config.writeEveryMs * 2), { kind: 'write', device: i });
    queue.push(now + rng.int(0, config.syncEveryMs), { kind: 'tick', device: i });
  }

  const quiet = () =>
    devices.every((d) => d.online && d.outbox.length === 0 && d.cursor === server.log.length);

  let events = 0;
  for (;;) {
    if (healed && quiet()) break;
    const next = queue.pop();
    if (!next) throw new Error(`seed ${config.seed}: event queue ran dry`);
    if (++events > MAX_EVENTS) throw new Error(`seed ${config.seed}: did not quiesce`);
    now = next.time;
    if (!healed && now >= end) {
      healed = true;
      for (const d of devices) d.online = true;
      trace.push(`${now} heal`);
    }
    const e = next.event;
    const d = devices[e.device]!;
    switch (e.kind) {
      case 'write': {
        if (healed) break; // no new writes once healing starts
        const op = randomWrite(d, rng);
        d.record(op);
        ops.push(op);
        trace.push(`${now} write ${op.opId} ${op.field}`);
        queue.push(now + rng.int(1, config.writeEveryMs * 2), e);
        break;
      }
      case 'tick': {
        if (!healed && d.online && rng.next() < config.partitionRate) {
          d.online = false;
          stats.partitions++;
          trace.push(`${now} offline ${d.id}`);
          queue.push(now + rng.int(1, config.maxPartitionMs), {
            kind: 'reconnect',
            device: e.device,
          });
        }
        for (const req of d.tick(now)) {
          trace.push(`${now} send ${req.type} ${req.requestId}`);
          send({ kind: 'to-server', device: e.device, req });
        }
        queue.push(now + config.syncEveryMs, e);
        break;
      }
      case 'reconnect':
        d.online = true;
        trace.push(`${now} online ${d.id}`);
        break;
      case 'to-server': {
        if (!d.online) break; // the device's link is down: the message is lost
        const res = e.req.type === 'push' ? server.push(e.req, now) : server.pull(e.req);
        trace.push(`${now} server ${e.req.type} ${e.req.requestId} log=${server.log.length}`);
        send({ kind: 'to-device', device: e.device, res });
        break;
      }
      case 'to-device': {
        if (!d.online) break;
        trace.push(`${now} recv ${e.res.type} ${e.res.requestId} -> ${d.id}`);
        for (const req of d.handle(e.res, now)) send({ kind: 'to-server', device: e.device, req });
        break;
      }
    }
  }

  return {
    seed: config.seed,
    deviceSnapshots: devices.map((d) => d.writer.replica.snapshot()),
    serverSnapshot: server.replica.snapshot(),
    ops,
    accepted: server.log,
    refused: devices.reduce((n, d) => n + d.refused.length, 0),
    quiescedAt: now - START,
    stats,
    trace,
  };
}

/** A clean replay of `ops` into a fresh replica: the state everyone must converge to. */
export function replay(ops: readonly Op[], schema: Schema = SIM_SCHEMA): Replica {
  const r = new Replica(schema);
  for (const op of ops) r.apply(op);
  return r;
}

function randomWrite(d: SimDevice, rng: Rng): Op {
  const w = d.writer;
  const record = `dossier:${rng.int(0, 2)}`;
  const v = rng.int(0, 3);
  switch (rng.int(0, 4)) {
    case 0:
      return w.assign(record, 'name', `name-${v}`);
    case 1:
      return w.inc(record, 'visits', rng.int(-2, 5));
    case 2:
      return w.add(record, 'docs', `doc-${v}`);
    case 3:
      return w.remove(record, 'docs', `doc-${v}`);
    default:
      return w.assign(record, 'status', `status-${v}`);
  }
}

/** Min-queue on (time, insertion order): ties resolve deterministically. */
class EventQueue {
  #heap: { time: number; seq: number; event: Event }[] = [];
  #seq = 0;

  push(time: number, event: Event): void {
    const h = this.#heap;
    h.push({ time, seq: this.#seq++, event });
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.#less(h[i]!, h[p]!)) break;
      [h[i], h[p]] = [h[p]!, h[i]!];
      i = p;
    }
  }

  pop(): { time: number; event: Event } | undefined {
    const h = this.#heap;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0 && last) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.#less(h[l]!, h[m]!)) m = l;
        if (r < h.length && this.#less(h[r]!, h[m]!)) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m]!, h[i]!];
        i = m;
      }
    }
    return top;
  }

  #less(a: { time: number; seq: number }, b: { time: number; seq: number }): boolean {
    return a.time < b.time || (a.time === b.time && a.seq < b.seq);
  }
}
