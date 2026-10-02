import { initialHlc, type Op, receiveHlc, Replica, type Schema } from '@accordsync/core';
import type { PullRequest, PullResponse, PushRequest, PushResponse } from './protocol';

/** Server-side write rule: returns a refusal reason, or undefined to allow. */
export type WritePolicy = (op: Op) => string | undefined;

/** In-memory sync server: an append-only op log, ordered by arrival, read through cursors. */
export class SimServer {
  readonly replica: Replica;
  readonly log: Op[] = [];
  #hlc = initialHlc('server');
  readonly #maxSkewMs: number;

  readonly #policy: WritePolicy;

  constructor(schema: Schema, maxSkewMs: number, policy: WritePolicy = () => undefined) {
    this.replica = new Replica(schema);
    this.#maxSkewMs = maxSkewMs;
    this.#policy = policy;
  }

  push(req: PushRequest, now: number): PushResponse {
    const acked: string[] = [];
    const refused: { opId: string; reason: string }[] = [];
    for (const op of req.ops) {
      if (this.replica.has(op.opId)) {
        acked.push(op.opId); // a retried batch: already applied, acknowledge again
        continue;
      }
      const denied = this.#policy(op);
      if (denied) {
        refused.push({ opId: op.opId, reason: denied });
        continue;
      }
      try {
        this.replica.validate(op);
        this.#hlc = receiveHlc(this.#hlc, op.hlc, now, this.#maxSkewMs);
        this.replica.apply(op);
        this.log.push(op);
        acked.push(op.opId);
      } catch (e) {
        refused.push({ opId: op.opId, reason: (e as Error).message });
      }
    }
    return { type: 'push-ok', requestId: req.requestId, acked, refused };
  }

  pull(req: PullRequest): PullResponse {
    const from = Math.max(0, Math.min(req.cursor, this.log.length));
    const to = Math.min(this.log.length, from + req.limit);
    return {
      type: 'pull-ok',
      requestId: req.requestId,
      ops: this.log.slice(from, to),
      cursor: to,
      hasMore: to < this.log.length,
    };
  }
}
