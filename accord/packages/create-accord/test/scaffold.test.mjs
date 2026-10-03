import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const bin = new URL('../index.mjs', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('scaffolds a project with its name and version filled in', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'create-accord-')), 'My Field App');
  execFileSync('node', [bin, dir]);
  for (const f of [
    'package.json',
    'schema.ts',
    'accord.config.ts',
    'client.ts',
    'dev-token.mjs',
    'docker-compose.yml',
    '.env.example',
    '.gitignore',
    'README.md',
  ]) {
    assert.ok(existsSync(join(dir, f)), f);
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-field-app');
  assert.equal(pkg.dependencies['@accordsync/server'], `^${version}`);
  assert.ok(readFileSync(join(dir, 'README.md'), 'utf8').startsWith('# my-field-app'));
});

test('refuses a non-empty directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'create-accord-'));
  writeFileSync(join(dir, 'keep.txt'), 'x');
  assert.throws(() => execFileSync('node', [bin, dir], { stdio: 'pipe' }));
});

test('the dev token is a valid HS256 JWT', async () => {
  process.env.ACCORD_DEV_SECRET = 'test-secret-at-least-32-bytes-long!!';
  const { devToken } = await import(new URL('../template/dev-token.mjs', import.meta.url).href);
  const [h, p, s] = devToken('awa', { zones: ['dakar'] }).split('.');
  const { createHmac } = await import('node:crypto');
  assert.equal(
    createHmac('sha256', process.env.ACCORD_DEV_SECRET).update(`${h}.${p}`).digest('base64url'),
    s,
  );
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url')).zones, ['dakar']);
});
