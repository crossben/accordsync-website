import type { FieldRead, Schema } from '@accordsync/core';

/** The JWT claims Accord verified, as the app's auth server issued them. */
export type Claims = Record<string, unknown> & { sub: string };

/** A record as scope functions see it: its id and its current field values. */
export interface ScopedRecord {
  id: string;
  fields: Record<string, FieldRead>;
}

export type AuthConfig =
  | { jwksUrl: string; issuer?: string; audience?: string }
  /** Shared-secret HS256 tokens: for development and tests. Prefer JWKS in production. */
  | { hs256Secret: string; issuer?: string; audience?: string };

export interface ServerDefinition<S extends Schema = Schema> {
  schema: S;
  /** For each record type: the scope keys a record belongs to, computed from its current state. */
  scopes: { [T in keyof S & string]: (record: ScopedRecord) => readonly string[] };
  /** The scope keys a user may read and write, from their verified JWT claims. */
  access: (claims: Claims) => { read: readonly string[]; write: readonly string[] };
  auth: AuthConfig;
  /** Browser origins allowed to call the sync API, e.g. ['https://app.example.com']. */
  cors?: readonly string[];
  /**
   * Prometheus metrics at GET /metrics. Scrapers must send `Authorization: Bearer <token>`.
   * Omit to disable the endpoint.
   */
  metrics?: { token: string };
  /** Log compaction (ADR-0005, ADR-0008). */
  compaction?: {
    /** A device unseen this long is retired and no longer holds compaction back (default 30). */
    deviceTtlDays?: number;
    /** How often `accord serve` compacts; 0 disables it (default every hour). */
    intervalMs?: number;
    /** Only records with at least this many ops are compacted (default 20). */
    minOps?: number;
  };
  limits?: {
    /** Request body size in bytes (default 5 MiB); larger requests get 413. */
    maxBodyBytes?: number;
    /** Ops per push request (default 500). */
    maxPushOps?: number;
    /** Items per pull page (default 1000). */
    maxPullLimit?: number;
    /** Ops whose clock is further ahead than this are refused (default 24 h). */
    maxSkewMs?: number;
  };
}

/** Declares an Accord server. Checked at startup: every record type needs a scope function. */
export function defineServer<S extends Schema>(def: ServerDefinition<S>): ServerDefinition<S> {
  for (const type of Object.keys(def.schema)) {
    if (typeof (def.scopes as Record<string, unknown>)[type] !== 'function') {
      throw new Error(`defineServer: no scope function for record type "${type}"`);
    }
  }
  if (!('jwksUrl' in def.auth) && !('hs256Secret' in def.auth)) {
    throw new Error('defineServer: auth needs jwksUrl or hs256Secret');
  }
  return def;
}
