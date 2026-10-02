import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ClockSkewError,
  compareHlc,
  decodeHlc,
  encodeHlc,
  type Hlc,
  initialHlc,
  MAX_COUNTER,
  receiveHlc,
  tickHlc,
} from './hlc';

const hlcArb = fc.record({
  wall: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  counter: fc.integer({ min: 0, max: 99_999 }),
  node: fc.stringMatching(/^[a-z0-9-]{1,12}$/),
});

describe('hlc', () => {
  it('round-trips through its wire encoding', () => {
    fc.assert(
      fc.property(hlcArb, (h) => {
        expect(decodeHlc(encodeHlc(h))).toEqual(h);
      }),
    );
  });

  it('encodes in the documented format', () => {
    expect(encodeHlc({ wall: 1727871000123, counter: 4, node: 'dev-7f3a' })).toBe(
      '1727871000123:00004:dev-7f3a',
    );
  });

  it('rejects malformed encodings', () => {
    for (const bad of ['', '1:2', 'x:00001:a', '1:00001:', '-1:00001:a', '1:00001:a:b']) {
      expect(() => decodeHlc(bad), bad).toThrow();
    }
  });

  it('orders totally and consistently with the encoding sort for same-width walls', () => {
    fc.assert(
      fc.property(hlcArb, hlcArb, (a, b) => {
        expect(Math.sign(compareHlc(a, b))).toBe(-Math.sign(compareHlc(b, a)));
        if (compareHlc(a, b) === 0) expect(a).toEqual(b);
      }),
    );
  });

  it('tick is strictly increasing even when the wall clock goes backwards', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 10_000 }), { maxLength: 50 }), (nows) => {
        let h = initialHlc('a');
        for (const now of nows) {
          const next = tickHlc(h, now);
          expect(compareHlc(next, h)).toBeGreaterThan(0);
          h = next;
        }
      }),
    );
  });

  it('receive moves past both the local and the remote clock', () => {
    fc.assert(
      fc.property(hlcArb, hlcArb, fc.integer({ min: 0, max: 4_000_000_000_000 }), (l, r, now) => {
        const local: Hlc = { ...l, node: 'local' };
        const next = receiveHlc(local, r, now, Number.MAX_SAFE_INTEGER);
        expect(compareHlc(next, local)).toBeGreaterThan(0);
        expect(next.wall > r.wall || (next.wall === r.wall && next.counter > r.counter)).toBe(true);
        expect(next.node).toBe('local');
      }),
    );
  });

  it('a full counter rolls into the next millisecond instead of failing', () => {
    const full: Hlc = { wall: 5, counter: MAX_COUNTER, node: 'b' };
    expect(tickHlc({ ...full, node: 'a' }, 0)).toEqual({ wall: 6, counter: 0, node: 'a' });
    expect(receiveHlc(initialHlc('a'), full, 0, 1_000)).toEqual({ wall: 6, counter: 0, node: 'a' });
  });

  it('refuses a remote clock too far in the future', () => {
    const local = initialHlc('a');
    const remote: Hlc = { wall: 10_000_000, counter: 0, node: 'b' };
    expect(() => receiveHlc(local, remote, 1_000, 60_000)).toThrow(ClockSkewError);
    expect(() => receiveHlc(local, remote, 9_990_000, 60_000)).not.toThrow();
  });
});
