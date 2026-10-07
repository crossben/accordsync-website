/**
 * A minimal black-box client for the conformance suite: HTTP only, no server code. Every response
 * is checked against the published protocol schemas (`protocol/v1/*.schema.json`) and must carry
 * `Accord-Protocol: 1`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { expect } from 'vitest';
import profileJson from '../profile.json' with { type: 'json' };

export const profile = profileJson;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see conformance/README.md)`);
  return v.replace(/\/+$/, '');
}
export const ACCORD_URL = env('ACCORD_URL');
export const CONTROL_URL = env('ACCORD_CONTROL_URL');

// ---------------------------------------------------------------- protocol schemas

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '../../protocol/v1');
const ajv = new Ajv2020({ strict: false, allErrors: true });
for (const name of ['WireOp', 'PushRequest', 'PushResponse', 'PullItem', 'PullResponse']) {
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, `${name}.schema.json`), 'utf8')));
}
const validators: Record<string, ValidateFunction> = {};
export function assertSchema(name: string, body: unknown): void {
  const v = (validators[name] ??= ajv.getSchema(name)!);
  if (!v(body)) {
    throw new Error(
      `response does not match ${name}.schema.json: ${ajv.errorsText(v.errors)}\n${JSON.stringify(body)}`,
    );
  }
}

// ---------------------------------------------------------------- wire types

export type WireOp = {
  op_id: string;
  record: string;
  field: string;
  hlc: string;
} & (
  | { kind: 'assign'; value: unknown; deps: string[] }
  | { kind: 'inc'; by: number }
  | { kind: 'add'; element: string | number; deps?: string[] }
  | { kind: 'remove'; element: string | number; deps: string[] }
);
export interface Snapshot {
  record: string;
  fields: Record<string, unknown>;
}
export type PullItem =
  | { type: 'op'; op: WireOp }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'exit'; record: string };
export interface PullPage {
  items: PullItem[];
  cursor: number;
  has_more: boolean;
  device_seq?: number;
}
export type PullResponse = PullPage | { resync_required: true };
export interface PushResponse {
  acked: string[];
  refused: { op_id: string; reason: string }[];
}

export interface Answer<T> {
  status: number;
  headers: Headers;
  body: T;
}

/** Every Accord response carries the protocol version; error bodies are `{ "error": string }`. */
async function answer<T>(res: Response, schema?: string): Promise<Answer<T>> {
  expect(res.headers.get('Accord-Protocol'), `Accord-Protocol header on ${res.url}`).toBe('1');
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${res.status} ${res.url}: body is not JSON: ${text.slice(0, 200)}`);
  }
  if (res.status >= 400) assertError(body);
  else if (schema && res.status === 200) assertSchema(schema, body);
  return { status: res.status, headers: res.headers, body: body as T };
}

export function assertError(body: unknown): asserts body is { error: string } {
  expect(body).toEqual({ error: expect.any(String) });
  expect((body as { error: string }).error.length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------- raw HTTP

export async function http(
  path: string,
  init: RequestInit & { schema?: string } = {},
): Promise<Answer<unknown>> {
  const { schema, ...rest } = init;
  return answer(await fetch(`${ACCORD_URL}${path}`, rest), schema);
}

// ---------------------------------------------------------------- control API

async function ctl<T>(method: string, path: string): Promise<T> {
  const res = await fetch(`${CONTROL_URL}${path}`, { method });
  const text = await res.text();
  if (!res.ok) throw new Error(`control ${method} ${path}: ${res.status} ${text}`);
  return JSON.parse(text) as T;
}

export const control = {
  reset: () => ctl<unknown>('POST', '/reset'),
  compact: () =>
    ctl<{ watermark: number; records: number; opsFolded: number; tombstonesPruned: number }>(
      'POST',
      '/compact',
    ),
  ageDevice: (device: string, days: number) =>
    ctl<unknown>(
      'POST',
      `/age-device?device=${encodeURIComponent(device)}&days=${encodeURIComponent(days)}`,
    ),
  /** Locks a record's row in a transaction of its own, until `release()`. */
  holdRecord: (record: string) =>
    ctl<unknown>('POST', `/hold-record?record=${encodeURIComponent(record)}`),
  /** How many database sessions are waiting for the held row lock. */
  held: () => ctl<{ waiting: number }>('GET', '/held'),
  release: () => ctl<unknown>('POST', '/release'),
  async token(
    sub: string,
    claims: { zones?: string[]; readonly_zones?: string[]; exp_in?: number } = {},
  ): Promise<string> {
    const q = new URLSearchParams({ sub });
    for (const z of claims.zones ?? []) q.append('zone', z);
    for (const z of claims.readonly_zones ?? []) q.append('readonly_zone', z);
    if (claims.exp_in !== undefined) q.set('exp_in', String(claims.exp_in));
    return (await ctl<{ token: string }>('GET', `/token?${q}`)).token;
  },
};

// ---------------------------------------------------------------- a device

/**
 * One device: numbers its ops `<id>:1, <id>:2, …` and stamps them with a hybrid logical clock
 * `<wall ms>:<counter, 5 digits>:<id>`, as every Accord client does (docs/protocol.md).
 */
export class Device {
  seq = 0;
  cursor = 0;
  deviceSeq: number | undefined;
  #wall = 0;
  #counter = 0;

  constructor(
    readonly id: string,
    public jwt: string,
  ) {}

  static async of(id: string, sub: string, claims: Parameters<typeof control.token>[1] = {}) {
    return new Device(id, await control.token(sub, claims));
  }

  hlc(skewMs = 0): string {
    const now = Date.now() + skewMs;
    if (now > this.#wall) {
      this.#wall = now;
      this.#counter = 0;
    } else this.#counter++;
    return `${this.#wall}:${String(this.#counter).padStart(5, '0')}:${this.id}`;
  }

  #base(record: string, field: string) {
    return { op_id: `${this.id}:${++this.seq}`, record, field, hlc: this.hlc() };
  }
  assign(record: string, field: string, value: unknown, deps: string[] = []): WireOp {
    return { ...this.#base(record, field), kind: 'assign', value, deps };
  }
  inc(record: string, field: string, by = 1): WireOp {
    return { ...this.#base(record, field), kind: 'inc', by };
  }
  add(record: string, field: string, element: string | number, deps: string[] = []): WireOp {
    const base = { ...this.#base(record, field), kind: 'add' as const, element };
    return deps.length ? { ...base, deps } : base;
  }
  remove(record: string, field: string, element: string | number, deps: string[]): WireOp {
    return { ...this.#base(record, field), kind: 'remove', element, deps };
  }

  headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.jwt}`, 'Accord-Device': this.id, ...extra };
  }

  /** POST /v1/push with raw ops (anything JSON). */
  async push(ops: unknown[]): Promise<Answer<PushResponse>> {
    return this.pushBody(JSON.stringify({ ops }));
  }
  async pushBody(body: string): Promise<Answer<PushResponse>> {
    return answer(
      await fetch(`${ACCORD_URL}/v1/push`, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body,
      }),
      'PushResponse',
    );
  }
  /** Pushes and expects a 200; returns the body. */
  async pushOk(ops: unknown[]): Promise<PushResponse> {
    const r = await this.push(ops);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body;
  }

  async pullRaw(cursor = this.cursor, limit?: number): Promise<Answer<PullResponse>> {
    const q = limit === undefined ? `cursor=${cursor}` : `cursor=${cursor}&limit=${limit}`;
    return answer(
      await fetch(`${ACCORD_URL}/v1/pull?${q}`, { headers: this.headers() }),
      'PullResponse',
    );
  }
  async pull(cursor = this.cursor, limit?: number): Promise<PullResponse> {
    const r = await this.pullRaw(cursor, limit);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body;
  }
  async page(cursor = this.cursor, limit?: number): Promise<PullPage> {
    const p = await this.pull(cursor, limit);
    if ('resync_required' in p) throw new Error('unexpected resync_required');
    return p;
  }

  /** Pulls every page from the stored cursor, as a client does. Returns every item, in order. */
  async pullAll(limit?: number): Promise<PullItem[]> {
    const seen: PullItem[] = [];
    for (let pages = 0; ; pages++) {
      if (pages > 10_000) throw new Error('has_more never ended');
      const p = await this.page(this.cursor, limit);
      expect(p.cursor).toBeGreaterThanOrEqual(this.cursor);
      seen.push(...p.items);
      this.cursor = p.cursor;
      this.deviceSeq = p.device_seq;
      if (!p.has_more) return seen;
    }
  }
}

export const opIds = (items: PullItem[]): string[] =>
  items.flatMap((i) => (i.type === 'op' ? [i.op.op_id] : []));
export const types = (items: PullItem[]): string[] => items.map((i) => i.type);
