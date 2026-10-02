import { compareHlc, decodeHlc, encodeHlc } from './hlc';
import type { AssignOp, JsonValue, Op, OpId, SetElement } from './op';
import { compareOpIds } from './op';
import type { StrategyName } from './schema';

/**
 * Per-field state. Each strategy's `apply` is commutative and associative over distinct ops:
 * any delivery order of the same set of ops yields the same state. The replica guarantees each
 * op is applied at most once (by op id), which makes the whole merge idempotent.
 */
export type FieldState =
  | { readonly strategy: 'lww'; winner: AssignOp | undefined }
  | { readonly strategy: 'counter'; total: number }
  | { readonly strategy: 'set'; tags: Map<OpId, SetElement>; removed: Set<OpId> }
  | { readonly strategy: 'conflict'; live: Map<OpId, JsonValue>; superseded: Set<OpId> };

/** A `conflict()` field as the app sees it. */
export type ConflictRead =
  { value: JsonValue } | { conflicted: { value: JsonValue; opId: OpId }[] };

export type FieldRead = JsonValue | SetElement[] | ConflictRead | undefined;

export function emptyState(strategy: StrategyName): FieldState {
  switch (strategy) {
    case 'lww':
      return { strategy, winner: undefined };
    case 'counter':
      return { strategy, total: 0 };
    case 'set':
      return { strategy, tags: new Map(), removed: new Set() };
    case 'conflict':
      return { strategy, live: new Map(), superseded: new Set() };
  }
}

/** Applies `op` to `state` in place. The op must already be validated against the schema. */
export function applyOp(state: FieldState, op: Op): void {
  switch (state.strategy) {
    case 'lww': {
      if (op.kind !== 'assign') break;
      const w = state.winner;
      if (!w || compareHlc(op.hlc, w.hlc) > 0) state.winner = op;
      return;
    }
    case 'counter':
      if (op.kind !== 'inc') break;
      state.total += op.by;
      return;
    case 'set':
      if (op.kind === 'add') {
        if (!state.removed.has(op.opId)) state.tags.set(op.opId, op.element);
        return;
      }
      if (op.kind === 'remove') {
        for (const tag of op.deps) {
          state.removed.add(tag);
          state.tags.delete(tag);
        }
        return;
      }
      break;
    case 'conflict':
      if (op.kind !== 'assign') break;
      for (const dep of op.deps) {
        state.superseded.add(dep);
        state.live.delete(dep);
      }
      if (!state.superseded.has(op.opId)) state.live.set(op.opId, op.value);
      return;
  }
  throw new Error(`op kind "${op.kind}" does not apply to a ${state.strategy} field`);
}

export function readState(state: FieldState): FieldRead {
  switch (state.strategy) {
    case 'lww':
      return state.winner?.value;
    case 'counter':
      return state.total;
    case 'set':
      return [...new Set(state.tags.values())].sort(compareElements);
    case 'conflict': {
      const live = [...state.live].sort(([a], [b]) => compareOpIds(a, b));
      if (live.length === 0) return undefined;
      if (live.length === 1) return { value: live[0]![1] };
      return { conflicted: live.map(([opId, value]) => ({ value, opId })) };
    }
  }
}

/** Op ids a writer must cite in `deps`: live conflict values, or the tags of a set element. */
export function observedDeps(state: FieldState, element?: SetElement): OpId[] {
  if (state.strategy === 'conflict') return [...state.live.keys()].sort(compareOpIds);
  if (state.strategy === 'set') {
    return [...state.tags]
      .filter(([, e]) => e === element)
      .map(([tag]) => tag)
      .sort(compareOpIds);
  }
  return [];
}

/** Numbers first (ascending), then strings (by code unit). */
function compareElements(a: SetElement, b: SetElement): number {
  if (typeof a !== typeof b) return typeof a === 'number' ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A field's live state, as JSON. Tombstones (removed set tags, superseded conflict values) are
 * dropped: on the server feed every op comes after the ops its `deps` name, so nothing that a
 * tombstone guards against can arrive after a snapshot (ADR-0008).
 */
export type FieldSnapshot =
  | { strategy: 'lww'; winner: { opId: OpId; hlc: string; value: JsonValue } | null }
  | { strategy: 'counter'; total: number }
  | { strategy: 'set'; tags: [OpId, SetElement][] }
  | { strategy: 'conflict'; live: [OpId, JsonValue][] };

export function snapshotState(state: FieldState): FieldSnapshot {
  switch (state.strategy) {
    case 'lww': {
      const w = state.winner;
      return {
        strategy: 'lww',
        winner: w ? { opId: w.opId, hlc: encodeHlc(w.hlc), value: w.value } : null,
      };
    }
    case 'counter':
      return { strategy: 'counter', total: state.total };
    case 'set':
      return { strategy: 'set', tags: [...state.tags].sort(([a], [b]) => compareOpIds(a, b)) };
    case 'conflict':
      return { strategy: 'conflict', live: [...state.live].sort(([a], [b]) => compareOpIds(a, b)) };
  }
}

export function stateFromSnapshot(snap: FieldSnapshot): FieldState {
  switch (snap.strategy) {
    case 'lww': {
      const w = snap.winner;
      const hlc = w ? decodeHlc(w.hlc) : undefined;
      return {
        strategy: 'lww',
        winner:
          w && hlc
            ? { opId: w.opId, record: '', field: '', hlc, kind: 'assign', value: w.value, deps: [] }
            : undefined,
      };
    }
    case 'counter':
      return { strategy: 'counter', total: snap.total };
    case 'set':
      return { strategy: 'set', tags: new Map(snap.tags), removed: new Set() };
    case 'conflict':
      return { strategy: 'conflict', live: new Map(snap.live), superseded: new Set() };
  }
}
