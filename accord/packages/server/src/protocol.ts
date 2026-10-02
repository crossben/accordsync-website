import { type Static, Type } from '@sinclair/typebox';

/**
 * Sync protocol v1 envelopes. The JSON Schemas published in `protocol/v1/` are generated from these
 * (see `scripts/emit-protocol.ts`); a test fails if the committed files drift.
 */
const OpId = Type.String({ pattern: '^[A-Za-z0-9_-]{1,64}:[1-9][0-9]{0,15}$' });
const Base = {
  op_id: OpId,
  record: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_]{0,63}:.{1,256}$' }),
  field: Type.String({ minLength: 1 }),
  hlc: Type.String({ pattern: '^[0-9]{1,16}:[0-9]{5}:[A-Za-z0-9_-]{1,64}$' }),
};
const Element = Type.Union([Type.String(), Type.Number()]);

export const WireOpSchema = Type.Union(
  [
    Type.Object(
      { ...Base, kind: Type.Literal('assign'), value: Type.Unknown(), deps: Type.Array(OpId) },
      { additionalProperties: false },
    ),
    Type.Object(
      { ...Base, kind: Type.Literal('inc'), by: Type.Integer() },
      { additionalProperties: false },
    ),
    Type.Object(
      { ...Base, kind: Type.Literal('add'), element: Element },
      { additionalProperties: false },
    ),
    Type.Object(
      { ...Base, kind: Type.Literal('remove'), element: Element, deps: Type.Array(OpId) },
      { additionalProperties: false },
    ),
  ],
  { $id: 'WireOp', description: 'One operation on one field of one record.' },
);

export const PushRequestSchema = Type.Object(
  { ops: Type.Array(Type.Unknown(), { description: 'WireOp objects, in write order.' }) },
  { $id: 'PushRequest', additionalProperties: false },
);

export const PushResponseSchema = Type.Object(
  {
    acked: Type.Array(OpId, { description: 'Applied now or earlier: drop them from the outbox.' }),
    refused: Type.Array(Type.Object({ op_id: Type.String(), reason: Type.String() }), {
      description: 'Never applied: roll them back locally and tell the app (ADR-0006).',
    }),
  },
  { $id: 'PushResponse', additionalProperties: false },
);

export const PullItemSchema = Type.Union(
  [
    Type.Object({ type: Type.Literal('op'), op: Type.Unsafe<object>({ $ref: 'WireOp' }) }),
    Type.Object(
      {
        type: Type.Literal('snapshot'),
        snapshot: Type.Object({
          record: Type.String(),
          fields: Type.Record(Type.String(), Type.Unknown()),
        }),
      },
      {
        description:
          "A record's state with its older ops folded away: replace the local record with it, then re-apply local unpushed ops (ADR-0008).",
      },
    ),
    Type.Object(
      { type: Type.Literal('exit'), record: Type.String() },
      { description: 'The record left your scope: delete the local copy (ADR-0004).' },
    ),
  ],
  { $id: 'PullItem' },
);

export const PullResponseSchema = Type.Union(
  [
    Type.Object(
      {
        items: Type.Array(Type.Unsafe<object>({ $ref: 'PullItem' })),
        cursor: Type.Integer({ minimum: 0, description: 'Send it back as ?cursor= next time.' }),
        has_more: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      { resync_required: Type.Literal(true) },
      {
        additionalProperties: false,
        description:
          'Your read scopes changed: push your outbox, drop local data, pull again from cursor 0.',
      },
    ),
  ],
  { $id: 'PullResponse' },
);

export type PushResponse = Static<typeof PushResponseSchema>;
export type PullItem =
  | { type: 'op'; op: import('@accordsync/core').WireOp }
  | { type: 'snapshot'; snapshot: import('@accordsync/core').RecordSnapshot }
  | { type: 'exit'; record: string };
export type PullResponse =
  { items: PullItem[]; cursor: number; has_more: boolean } | { resync_required: true };

export const PROTOCOL_SCHEMAS = {
  WireOp: WireOpSchema,
  PushRequest: PushRequestSchema,
  PushResponse: PushResponseSchema,
  PullItem: PullItemSchema,
  PullResponse: PullResponseSchema,
};
