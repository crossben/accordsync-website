import { type OpKind, recordType } from './op';

export type StrategyName = 'lww' | 'counter' | 'set' | 'conflict';

export interface Strategy {
  readonly strategy: StrategyName;
}

/** Highest clock wins. For names, notes and simple scalars. */
export const lww = (): Strategy => ({ strategy: 'lww' });
/** Sum of all increments; none is ever lost. For quantities and stock adjustments. */
export const counter = (): Strategy => ({ strategy: 'counter' });
/** Add-wins set of strings or numbers. For tags and assigned agents. */
export const set = (): Strategy => ({ strategy: 'set' });
/** Concurrent values are all kept and the field is flagged; the app resolves it. Never guesses. */
export const conflict = (): Strategy => ({ strategy: 'conflict' });

export type RecordFields = Readonly<Record<string, Strategy>>;
export type Schema = Readonly<Record<string, RecordFields>>;

export const KINDS: Readonly<Record<StrategyName, readonly OpKind[]>> = {
  lww: ['assign'],
  conflict: ['assign'],
  counter: ['inc'],
  set: ['add', 'remove'],
};

export function defineSchema<S extends Schema>(schema: S): S {
  for (const [type, fields] of Object.entries(schema)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(type))
      throw new Error(`invalid record type "${type}"`);
    for (const [field, s] of Object.entries(fields)) {
      if (!(s.strategy in KINDS)) throw new Error(`${type}.${field}: unknown strategy`);
    }
  }
  return schema;
}

/** The strategy for `record.field`, or an error naming what is wrong. */
export function strategyFor(schema: Schema, record: string, field: string): StrategyName {
  const type = recordType(record);
  const fields = schema[type];
  if (!fields) throw new Error(`unknown record type "${type}"`);
  const s = fields[field];
  if (!s) throw new Error(`unknown field "${type}.${field}"`);
  return s.strategy;
}

export function fieldsOf(schema: Schema, record: string): RecordFields {
  const fields = schema[recordType(record)];
  if (!fields) throw new Error(`unknown record type "${recordType(record)}"`);
  return fields;
}
