import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeOp, LocalWriter } from '@accordsync/core';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_DIR, render } from '../scripts/emit-protocol';
import { PROTOCOL_SCHEMAS, WireOpSchema } from '../src/protocol';
import { schema } from './harness';

describe('published protocol', () => {
  it('protocol/v1 matches the TypeBox definitions (run protocol:emit after changing them)', () => {
    for (const [name, s] of Object.entries(PROTOCOL_SCHEMAS)) {
      expect(readFileSync(join(PROTOCOL_DIR, `${name}.schema.json`), 'utf8'), name).toBe(render(s));
    }
  });

  it('every op the core encodes is a valid WireOp', () => {
    const w = new LocalWriter({ schema, deviceId: 'd', now: () => 1 });
    const ops = [
      w.assign('dossier:1', 'status', { nested: [1, 'x'] }),
      w.inc('dossier:1', 'visits', -3),
      w.add('dossier:1', 'docs', 'cni.pdf'),
      w.remove('dossier:1', 'docs', 'cni.pdf'),
    ];
    for (const op of ops) expect(Value.Check(WireOpSchema, encodeOp(op))).toBe(true);
  });
});
