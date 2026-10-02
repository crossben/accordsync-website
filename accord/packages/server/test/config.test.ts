import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('requires a database URL', () => {
    expect(() => loadConfig({})).toThrow(/ACCORD_DATABASE_URL/);
  });

  it('defaults the port to 8080', () => {
    expect(loadConfig({ ACCORD_DATABASE_URL: 'postgres://x' }).port).toBe(8080);
  });

  it('rejects a bad port', () => {
    expect(() => loadConfig({ ACCORD_DATABASE_URL: 'postgres://x', ACCORD_PORT: 'abc' })).toThrow(
      /ACCORD_PORT/,
    );
  });
});
