import { canonicalJson } from './canonical';
import { compareOpIds, type Op, type OpId, parseOpId } from './op';
import { fieldsOf, KINDS, type Schema, strategyFor } from './schema';
import {
  applyOp,
  emptyState,
  type FieldRead,
  type FieldSnapshot,
  type FieldState,
  observedDeps,
  readState,
  snapshotState,
  stateFromSnapshot,
} from './strategies';

/** A record's state with its history folded away (log compaction, ADR-0008). */
export interface RecordSnapshot {
  record: string;
  fields: Record<string, FieldSnapshot>;
}

export type ApplyResult = 'applied' | 'duplicate';

/**
 * An op log and the state projected from it. Pure: no I/O, no clock. Two replicas holding the
 * same set of ops always read the same state, whatever order the ops arrived in.
 */
export class Replica {
  readonly #schema: Schema;
  readonly #ops = new Map<OpId, Op>();
  readonly #records = new Map<string, Map<string, FieldState>>();
  /** Snapshots this replica's state was started from, by record. */
  readonly #bases = new Map<string, RecordSnapshot>();

  constructor(schema: Schema) {
    this.#schema = schema;
  }

  get schema(): Schema {
    return this.#schema;
  }

  has(opId: OpId): boolean {
    return this.#ops.has(opId);
  }

  get size(): number {
    return this.#ops.size;
  }

  /** All ops, in a deterministic order. */
  ops(): Op[] {
    return [...this.#ops.values()].sort((a, b) => compareOpIds(a.opId, b.opId));
  }

  /** Throws (without changing anything) if the op does not fit the schema. */
  validate(op: Op): void {
    const strategy = strategyFor(this.#schema, op.record, op.field);
    if (!KINDS[strategy].includes(op.kind)) {
      throw new Error(`op kind "${op.kind}" does not apply to ${op.field}, a ${strategy} field`);
    }
    const { device } = parseOpId(op.opId);
    if (device !== op.hlc.node) {
      throw new Error(`op ${op.opId} carries a clock from "${op.hlc.node}"`);
    }
  }

  apply(op: Op): ApplyResult {
    if (this.#ops.has(op.opId)) return 'duplicate';
    this.validate(op);
    applyOp(this.#state(op.record, op.field), op);
    this.#ops.set(op.opId, op);
    return 'applied';
  }

  /** The record's fields, or `undefined` if no op has touched it. */
  read(record: string): Record<string, FieldRead> | undefined {
    const states = this.#records.get(record);
    if (!states) return undefined;
    const out: Record<string, FieldRead> = {};
    for (const [field, s] of Object.entries(fieldsOf(this.#schema, record))) {
      const state = states.get(field);
      out[field] = readState(state ?? emptyState(s.strategy));
    }
    return out;
  }

  records(): string[] {
    return [...this.#records.keys()].sort();
  }

  /** Every `conflict()` field currently holding more than one value. */
  conflicts(): { record: string; field: string }[] {
    const out: { record: string; field: string }[] = [];
    for (const record of this.records()) {
      for (const [field, state] of [...this.#records.get(record)!].sort(([a], [b]) =>
        a < b ? -1 : 1,
      )) {
        if (state.strategy === 'conflict' && state.live.size > 1) out.push({ record, field });
      }
    }
    return out;
  }

  /** Op ids a new write to this field must cite (see `AssignOp` and `RemoveOp`). */
  observedDeps(record: string, field: string, element?: string | number): OpId[] {
    strategyFor(this.#schema, record, field);
    const state = this.#records.get(record)?.get(field);
    return state ? observedDeps(state, element) : [];
  }

  /** The whole state as canonical JSON: equal strings mean converged replicas. */
  snapshot(): string {
    return canonicalJson(Object.fromEntries(this.records().map((r) => [r, this.read(r)])));
  }

  /** The record's current state, with its history folded away. */
  snapshotRecord(record: string): RecordSnapshot {
    const fields: Record<string, FieldSnapshot> = {};
    for (const [field, state] of this.#records.get(record) ?? [])
      fields[field] = snapshotState(state);
    return { record, fields };
  }

  /**
   * Replaces a record's state with a snapshot and forgets that record's ops, except `keep` (local
   * ops not yet on the server), which are applied again on top.
   */
  loadSnapshot(snap: RecordSnapshot, keep: ReadonlySet<OpId> = new Set()): void {
    const reapply = [...this.#ops.values()].filter(
      (o) => o.record === snap.record && keep.has(o.opId),
    );
    for (const [id, op] of this.#ops) if (op.record === snap.record) this.#ops.delete(id);
    const fields = new Map<string, FieldState>();
    for (const [field, fs] of Object.entries(snap.fields)) {
      strategyFor(this.#schema, snap.record, field);
      fields.set(field, stateFromSnapshot(fs));
    }
    this.#records.set(snap.record, fields);
    this.#bases.set(snap.record, snap);
    for (const op of reapply) this.apply(op);
  }

  /** A copy without the given ops (same snapshots, every other op): used to roll back. */
  without(drop: ReadonlySet<OpId>): Replica {
    const next = new Replica(this.#schema);
    for (const snap of this.#bases.values()) next.loadSnapshot(snap);
    for (const op of this.ops()) if (!drop.has(op.opId)) next.apply(op);
    return next;
  }

  /** Forgets a record entirely (it left this device's scope), except ops in `keep`. */
  forget(record: string, keep: ReadonlySet<OpId>): Replica {
    const next = new Replica(this.#schema);
    for (const [r, snap] of this.#bases) if (r !== record) next.loadSnapshot(snap);
    for (const op of this.ops()) if (op.record !== record || keep.has(op.opId)) next.apply(op);
    return next;
  }

  /** Snapshots this replica was started from (to persist them alongside the ops). */
  bases(): RecordSnapshot[] {
    return [...this.#bases.values()];
  }

  #state(record: string, field: string): FieldState {
    let fields = this.#records.get(record);
    if (!fields) this.#records.set(record, (fields = new Map()));
    let state = fields.get(field);
    if (!state) fields.set(field, (state = emptyState(strategyFor(this.#schema, record, field))));
    return state;
  }
}
