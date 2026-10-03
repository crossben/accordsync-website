import { describe, expect, it } from 'vitest';
import { randomDeviceId } from '../src/client';

describe('randomDeviceId', () => {
  it('uses randomUUID when available', () => {
    expect(randomDeviceId({ randomUUID: () => '1234abcd-0000-0000-0000-000000000000' })).toBe(
      'd1234abcd000000000000000000000000',
    );
  });

  it('falls back to getRandomValues (React Native with react-native-get-random-values)', () => {
    const id = randomDeviceId({
      getRandomValues: <T extends ArrayBufferView | null>(a: T) => {
        (a as unknown as Uint8Array).fill(171);
        return a;
      },
    });
    expect(id).toBe(`d${'ab'.repeat(16)}`);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it('refuses to guess without a secure random source', () => {
    expect(() => randomDeviceId({})).toThrow(/react-native-get-random-values/);
  });
});
