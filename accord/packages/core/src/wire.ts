import { decodeHlc, encodeHlc } from './hlc';
import { type JsonValue, type Op, parseOpId, recordType } from './op';

/** An op as it travels over the network and sits in golden vectors. */
export type WireOp =
  | (WireBase & { kind: 'assign'; value: JsonValue; deps: string[] })
  | (WireBase & { kind: 'inc'; by: number })
  | (WireBase & { kind: 'add'; element: string | number; deps?: string[] })
  | (WireBase & { kind: 'remove'; element: string | number; deps: string[] });

interface WireBase {
  op_id: string;
  record: string;
  field: string;
  hlc: string;
}

export function encodeOp(op: Op): WireOp {
  const base = { op_id: op.opId, record: op.record, field: op.field, hlc: encodeHlc(op.hlc) };
  switch (op.kind) {
    case 'assign':
      return { ...base, kind: op.kind, value: op.value, deps: [...op.deps] };
    case 'inc':
      return { ...base, kind: op.kind, by: op.by };
    case 'add':
      // `deps` is omitted when empty, so first adds keep the v0.1 wire shape.
      return op.deps.length > 0
        ? { ...base, kind: op.kind, element: op.element, deps: [...op.deps] }
        : { ...base, kind: op.kind, element: op.element };
    case 'remove':
      return { ...base, kind: op.kind, element: op.element, deps: [...op.deps] };
  }
}

/** Parses untrusted input into an op, or throws with the reason. Schema checks happen later. */
export function decodeOp(input: unknown): Op {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('op must be an object');
  const o = input as Record<string, unknown>;
  const opId = str(o, 'op_id');
  const record = str(o, 'record');
  const field = str(o, 'field');
  const hlc = decodeHlc(str(o, 'hlc'));
  const { device } = parseOpId(opId);
  recordType(record);
  if (device !== hlc.node) throw new Error(`op ${opId} carries a clock from "${hlc.node}"`);
  const base = { opId, record, field, hlc };
  switch (o.kind) {
    case 'assign':
      if (!('value' in o) || o.value === undefined) throw new Error('assign needs a value');
      return { ...base, kind: 'assign', value: o.value as JsonValue, deps: deps(o) };
    case 'inc':
      if (!Number.isSafeInteger(o.by)) throw new Error('inc needs an integer "by"');
      return { ...base, kind: 'inc', by: o.by as number };
    case 'add':
      return { ...base, kind: 'add', element: element(o), deps: 'deps' in o ? deps(o) : [] };
    case 'remove':
      return { ...base, kind: 'remove', element: element(o), deps: deps(o) };
    default:
      throw new Error(`unknown op kind ${JSON.stringify(o.kind)}`);
  }
}

function str(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v !== 'string') throw new Error(`"${key}" must be a string`);
  return v;
}

function deps(o: Record<string, unknown>): string[] {
  const d = o.deps;
  if (!Array.isArray(d)) throw new Error('"deps" must be an array of op ids');
  for (const id of d) parseOpId(String(id));
  if (!d.every((id) => typeof id === 'string')) throw new Error('"deps" must contain strings');
  return d as string[];
}

function element(o: Record<string, unknown>): string | number {
  const e = o.element;
  if (typeof e === 'string' || (typeof e === 'number' && Number.isFinite(e))) return e;
  throw new Error('"element" must be a string or finite number');
}
