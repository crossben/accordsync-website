// Writes protocol/v1/*.schema.json from the TypeBox definitions. Run: pnpm --filter @accordsync/server protocol:emit
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROTOCOL_SCHEMAS } from '../src/protocol';

export const PROTOCOL_DIR = join(import.meta.dirname, '../../../protocol/v1');

export function render(schema: object): string {
  return `${JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...schema }, null, 2)}\n`;
}

if (process.argv[1] === import.meta.filename) {
  for (const [name, schema] of Object.entries(PROTOCOL_SCHEMAS)) {
    writeFileSync(join(PROTOCOL_DIR, `${name}.schema.json`), render(schema));
  }
  console.log(`wrote ${Object.keys(PROTOCOL_SCHEMAS).length} schemas to ${PROTOCOL_DIR}`);
}
