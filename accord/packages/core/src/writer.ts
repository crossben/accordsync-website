import { assertNode, type Hlc, initialHlc, receiveHlc, tickHlc } from './hlc';
import {
  type AddOp,
  type AssignOp,
  type IncOp,
  type JsonValue,
  type Op,
  parseOpId,
  type RemoveOp,
  type SetElement,
} from './op';
import { type ApplyResult, Replica } from './replica';
import type { Schema } from './schema';

export const DEFAULT_MAX_SKEW_MS = 24 * 60 * 60 * 1000;

export interface LocalWriterOptions {
  schema: Schema;
  deviceId: string;
  /** Physical time in ms. Injected: the core never reads the clock itself. */
  now: () => number;
  /** Remote clocks further ahead than this are refused (default 24 h). */
  maxSkewMs?: number;
  /** Resume a device: its last clock and op sequence number. */
  resume?: { hlc: Hlc; seq: number };
}

/**
 * One device's replica plus the means to write to it: every local write becomes an op, applied
 * locally first and returned so the caller can queue it for sync.
 */
export class LocalWriter {
  #replica: Replica;
  readonly deviceId: string;
  readonly #now: () => number;
  readonly #maxSkewMs: number;
  #hlc: Hlc;
  #seq: number;

  constructor(opts: LocalWriterOptions) {
    assertNode(opts.deviceId);
    this.deviceId = opts.deviceId;
    this.#replica = new Replica(opts.schema);
    this.#now = opts.now;
    this.#maxSkewMs = opts.maxSkewMs ?? DEFAULT_MAX_SKEW_MS;
    this.#hlc = opts.resume?.hlc ?? initialHlc(opts.deviceId);
    this.#seq = opts.resume?.seq ?? 0;
  }

  get replica(): Replica {
    return this.#replica;
  }

  get clock(): Hlc {
    return this.#hlc;
  }

  get seq(): number {
    return this.#seq;
  }

  assign(record: string, field: string, value: JsonValue): AssignOp {
    if (value === undefined) throw new Error('value must be JSON (use null for "no value")');
    const deps = this.replica.observedDeps(record, field);
    return this.#write({ ...this.#base(record, field), kind: 'assign', value, deps });
  }

  inc(record: string, field: string, by: number): IncOp {
    if (!Number.isSafeInteger(by))
      throw new Error(`counter increment must be an integer, got ${by}`);
    return this.#write({ ...this.#base(record, field), kind: 'inc', by });
  }

  add(record: string, field: string, element: SetElement): AddOp {
    assertElement(element);
    const deps = this.replica.observedDeps(record, field, element);
    return this.#write({ ...this.#base(record, field), kind: 'add', element, deps });
  }

  remove(record: string, field: string, element: SetElement): RemoveOp {
    assertElement(element);
    const deps = this.replica.observedDeps(record, field, element);
    return this.#write({ ...this.#base(record, field), kind: 'remove', element, deps });
  }

  /** Applies an op from elsewhere. Refuses it, leaving state untouched, if its clock is absurd. */
  receive(op: Op): ApplyResult {
    if (this.replica.has(op.opId)) {
      this.advanceSeq(op.opId);
      return 'duplicate';
    }
    this.replica.validate(op);
    const next = receiveHlc(this.#hlc, op.hlc, this.#now(), this.#maxSkewMs);
    const result = this.replica.apply(op);
    this.#hlc = next;
    this.advanceSeq(op.opId);
    return result;
  }

  /**
   * Makes sure future op ids come after `seenOrSeq`: an op id of this device (as received from the
   * server after a reinstall) or a sequence number the server reports. Op ids are never reused.
   */
  advanceSeq(seenOrSeq: string | number): void {
    let seq: number;
    if (typeof seenOrSeq === 'number') seq = seenOrSeq;
    else {
      const id = parseOpId(seenOrSeq);
      if (id.device !== this.deviceId) return;
      seq = id.seq;
    }
    if (seq > this.#seq) this.#seq = seq;
  }

  /**
   * Rolls back ops the server refused: the replica is rebuilt from its log without them, so this
   * device converges with everyone else instead of keeping a change nobody else will ever see.
   * The clock and sequence number are not rewound; op ids are never reused.
   */
  discard(opIds: Iterable<string>): void {
    this.#replica = this.#replica.without(new Set(opIds));
  }

  /** The record left this device's scope: forget it, except the local ops in `keep`. */
  forget(record: string, keep: ReadonlySet<string> = new Set()): void {
    this.#replica = this.#replica.forget(record, keep);
  }

  #base(record: string, field: string) {
    // Validate before consuming a clock tick or sequence number.
    this.replica.observedDeps(record, field);
    this.#hlc = tickHlc(this.#hlc, this.#now());
    this.#seq += 1;
    return { opId: `${this.deviceId}:${this.#seq}`, record, field, hlc: this.#hlc };
  }

  #write<T extends Op>(op: T): T {
    this.replica.apply(op);
    return op;
  }
}

function assertElement(e: unknown): asserts e is SetElement {
  if (typeof e !== 'string' && !(typeof e === 'number' && Number.isFinite(e))) {
    throw new Error('set elements must be a string or number');
  }
}
