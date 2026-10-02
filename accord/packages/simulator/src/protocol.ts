import type { Op, OpId } from '@accordsync/core';

/** Sync messages. They mirror the HTTP push/pull protocol the real server speaks (milestone M3). */
export interface PushRequest {
  type: 'push';
  requestId: string;
  ops: Op[];
}

export interface PushResponse {
  type: 'push-ok';
  requestId: string;
  /** Applied now or earlier: the device can drop these from its outbox. */
  acked: OpId[];
  refused: { opId: OpId; reason: string }[];
}

export interface PullRequest {
  type: 'pull';
  requestId: string;
  /** Number of server log entries the device has already applied. */
  cursor: number;
  limit: number;
}

export interface PullResponse {
  type: 'pull-ok';
  requestId: string;
  /** Server log entries [requestCursor, cursor). */
  ops: Op[];
  cursor: number;
  hasMore: boolean;
}

export type Request = PushRequest | PullRequest;
export type Response = PushResponse | PullResponse;
