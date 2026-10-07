#!/usr/bin/env node
// npm create accord my-app → a ready-to-run Accord project in ./my-app.
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));

const arg = process.argv[2];
if (!arg || arg.startsWith('-')) {
  console.log('Usage: npm create accord <directory>');
  process.exit(arg === '--help' || arg === '-h' ? 0 : 1);
}
const target = resolve(arg);
const name =
  basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'accord-app';
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`create-accord: ${target} exists and is not empty.`);
  process.exit(1);
}

cpSync(join(here, 'template'), target, { recursive: true });
// npm strips dotfiles from published packages: they ship without the dot.
for (const f of ['gitignore', 'env.example']) {
  if (existsSync(join(target, f))) renameSync(join(target, f), join(target, `.${f}`));
}
const replace = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) replace(path);
    else {
      const text = readFileSync(path, 'utf8');
      const out = text.replaceAll('__NAME__', name).replaceAll('__VERSION__', version);
      if (out !== text) writeFileSync(path, out);
    }
  }
};
replace(target);

console.log(`
Created ${name} in ${target}

  cd ${arg}
  safe-install install          # or: npm install
  docker compose up -d          # PostgreSQL
  cp .env.example .env
  safe-install run server       # Accord on http://localhost:8080
  safe-install run token -- awa # a development token for user "awa"
  safe-install run client       # writes offline, then syncs

safe-install (https://safe-install.benhattab.pro) installs with every install script off.

Next: edit schema.ts and accord.config.ts. Docs: https://github.com/crossben/accordsync
`);
