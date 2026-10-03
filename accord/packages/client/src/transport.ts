import type { RecordSnapshot, WireOp } from '@accordsync/core';

export interface PushResult {
  acked: string[];
  refused: { op_id: string; reason: string }[];
}

export type PullItem =
  | { type: 'op'; op: WireOp }
  | { type: 'snapshot'; snapshot: RecordSnapshot }
  | { type: 'exit'; record: string };

export type PullResult =
  | { items: PullItem[]; cursor: number; has_more: boolean; device_seq?: number }
  | { resync_required: true };

/** How a client reaches the server. `httpTransport` is the real one; tests can fake it. */
export interface Transport {
  push(deviceId: string, ops: WireOp[]): Promise<PushResult>;
  pull(deviceId: string, cursor: number, limit: number): Promise<PullResult>;
}

export class HttpError extends Error {
  override readonly name = 'HttpError';
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface HttpTransportOptions {
  /** Base URL of the Accord server, e.g. `https://sync.example.com`. */
  url: string;
  /** Returns the current JWT from your app's auth. Called before every request. */
  getToken: () => string | Promise<string>;
  fetch?: typeof globalThis.fetch;
}

/** Talks to an Accord server over HTTPS (see the server's docs/protocol.md). */
export function httpTransport(opts: HttpTransportOptions): Transport {
  const base = opts.url.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);

  const call = async <T>(deviceId: string, path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await opts.getToken()}`);
    headers.set('Accord-Device', deviceId);
    const res = await doFetch(`${base}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(res.status, `${init.method ?? 'GET'} ${path} → ${res.status} ${body}`);
    }
    return (await res.json()) as T;
  };

  return {
    push: (deviceId, ops) =>
      call(deviceId, '/v1/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ops }),
      }),
    pull: (deviceId, cursor, limit) => call(deviceId, `/v1/pull?cursor=${cursor}&limit=${limit}`),
  };
}
