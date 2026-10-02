/**
 * Version of the sync protocol spoken between Accord clients and servers.
 * A breaking change to the wire format bumps it.
 */
export const PROTOCOL_VERSION = 1;

export { canonicalJson } from './canonical';
export {
  assertNode,
  ClockSkewError,
  compareHlc,
  decodeHlc,
  encodeHlc,
  type Hlc,
  initialHlc,
  receiveHlc,
  tickHlc,
} from './hlc';
export {
  type AddOp,
  type AssignOp,
  compareOpIds,
  type IncOp,
  type JsonValue,
  type Op,
  type OpId,
  type OpKind,
  parseOpId,
  recordType,
  type RemoveOp,
  type SetElement,
} from './op';
export { type ApplyResult, type RecordSnapshot, Replica } from './replica';
export {
  conflict,
  counter,
  defineSchema,
  lww,
  type RecordFields,
  type Schema,
  set,
  type Strategy,
  type StrategyName,
} from './schema';
export type { ConflictRead, FieldRead, FieldSnapshot } from './strategies';
export { decodeOp, encodeOp, type WireOp } from './wire';
export { DEFAULT_MAX_SKEW_MS, LocalWriter, type LocalWriterOptions } from './writer';
