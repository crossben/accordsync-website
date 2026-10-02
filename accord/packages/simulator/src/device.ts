import { LocalWriter, type Op, type Schema } from '@accordsync/core';
import type { PullResponse, PushResponse, Request } from './protocol';

interface InFlight {
  requestId: string;
  sentAt: number;
}

/**
 * A simulated device: writes locally first, queues ops in an outbox, and syncs by pushing batches
 * and pulling pages. Lost requests are retried after a timeout; late or duplicate responses are
 * harmless because applying ops and acknowledgements is idempotent.
 */
export class SimDevice {
  readonly writer: LocalWriter;
  /** Local ops not yet acknowledged by the server, in write order. */
  readonly outbox: Op[] = [];
  readonly refused: { opId: string; reason: string }[] = [];
  cursor = 0;
  online = true;
  #push: InFlight | undefined;
  #pull: InFlight | undefined;
  #requests = 0;

  constructor(
    readonly id: string,
    schema: Schema,
    now: () => number,
    private readonly opts: {
      batchSize: number;
      pageSize: number;
      timeoutMs: number;
      maxSkewMs: number;
    },
  ) {
    this.writer = new LocalWriter({ schema, deviceId: id, now, maxSkewMs: opts.maxSkewMs });
  }

  record(op: Op): void {
    this.outbox.push(op);
  }

  /** Requests to send now: a push if the outbox has ops, and a pull, unless one is still pending. */
  tick(now: number): Request[] {
    if (!this.online) return [];
    const out: Request[] = [];
    const stale = (f: InFlight | undefined) => !f || now - f.sentAt >= this.opts.timeoutMs;
    if (this.outbox.length > 0 && stale(this.#push)) {
      const requestId = this.#nextId();
      this.#push = { requestId, sentAt: now };
      out.push({ type: 'push', requestId, ops: this.outbox.slice(0, this.opts.batchSize) });
    }
    if (stale(this.#pull)) out.push(this.#pullRequest(now));
    return out;
  }

  /** Handles a response; may return a follow-up request (the next page). */
  handle(res: PushResponse | PullResponse, now: number): Request[] {
    if (res.type === 'push-ok') {
      const done = new Set([...res.acked, ...res.refused.map((r) => r.opId)]);
      const fresh = res.refused.filter((r) => !this.refused.some((x) => x.opId === r.opId));
      this.refused.push(...fresh);
      if (fresh.length > 0) this.writer.discard(fresh.map((r) => r.opId));
      for (let i = this.outbox.length - 1; i >= 0; i--) {
        if (done.has(this.outbox[i]!.opId)) this.outbox.splice(i, 1);
      }
      if (this.#push?.requestId === res.requestId) this.#push = undefined;
      return [];
    }
    for (const op of res.ops) this.writer.receive(op);
    // The page covers [requestCursor, res.cursor) and the cursor only moves forward, so taking the
    // max is safe even for late or duplicated responses.
    this.cursor = Math.max(this.cursor, res.cursor);
    if (this.#pull?.requestId !== res.requestId) return [];
    this.#pull = undefined;
    return res.hasMore && this.online ? [this.#pullRequest(now)] : [];
  }

  #pullRequest(now: number): Request {
    const requestId = this.#nextId();
    this.#pull = { requestId, sentAt: now };
    return { type: 'pull', requestId, cursor: this.cursor, limit: this.opts.pageSize };
  }

  #nextId(): string {
    return `${this.id}#${++this.#requests}`;
  }
}
