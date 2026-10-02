import type { Hlc } from './hlc';

/** Any JSON value. Field values must survive a JSON round trip. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

/** Set elements are compared by value, so they are limited to strings and numbers. */
export type SetElement = string | number;

/** `deviceId:sequence`. Unique per op, so applying an op twice is a no-op. */
export type OpId = string;

interface OpBase {
  readonly opId: OpId;
  /** `type:id`, e.g. `dossier:91`. */
  readonly record: string;
  readonly field: string;
  readonly hlc: Hlc;
}

/**
 * Writes a value. For `lww` the highest clock wins. For `conflict`, `deps` lists the values the
 * writer could see; the assign supersedes exactly those, so resolving a conflict is an assign
 * whose deps name every conflicting value (ADR-0003).
 */
export interface AssignOp extends OpBase {
  readonly kind: 'assign';
  readonly value: JsonValue;
  readonly deps: readonly OpId[];
}

/** Adds `by` (a positive or negative integer) to a counter. */
export interface IncOp extends OpBase {
  readonly kind: 'inc';
  readonly by: number;
}

/** Adds an element to a set. The op id is the element's unique tag. */
export interface AddOp extends OpBase {
  readonly kind: 'add';
  readonly element: SetElement;
}

/** Removes the add-tags in `deps` (the ones the writer had seen); concurrent adds survive. */
export interface RemoveOp extends OpBase {
  readonly kind: 'remove';
  readonly element: SetElement;
  readonly deps: readonly OpId[];
}

export type Op = AssignOp | IncOp | AddOp | RemoveOp;
export type OpKind = Op['kind'];

const OP_ID = /^([A-Za-z0-9_-]{1,64}):([1-9]\d{0,15})$/;
const RECORD_ID = /^([A-Za-z][A-Za-z0-9_]{0,63}):(.{1,256})$/s;

export function parseOpId(opId: string): { device: string; seq: number } {
  const m = OP_ID.exec(opId);
  if (!m) throw new Error(`malformed op id "${opId}" (expected device:sequence)`);
  return { device: m[1]!, seq: Number(m[2]) };
}

export function recordType(record: string): string {
  const m = RECORD_ID.exec(record);
  if (!m) throw new Error(`malformed record id "${record}" (expected type:id)`);
  return m[1]!;
}

/** A stable sort order for op ids, used wherever output order must be deterministic. */
export function compareOpIds(a: OpId, b: OpId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
