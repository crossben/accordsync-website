/**
 * Hybrid logical clock: physical time + logical counter + node id.
 *
 * Orders events consistently even when device clocks are wrong, and `compareHlc` is a total order:
 * two distinct clocks never compare equal, because the node id breaks ties.
 */
export interface Hlc {
  /** Milliseconds since the Unix epoch, as seen by the node (possibly pushed forward by others). */
  readonly wall: number;
  /** Disambiguates events within the same `wall` millisecond. */
  readonly counter: number;
  /** The device or server that produced the clock. */
  readonly node: string;
}

export const MAX_COUNTER = 99_999;
const NODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class ClockSkewError extends Error {
  override readonly name = 'ClockSkewError';
}

export function initialHlc(node: string): Hlc {
  assertNode(node);
  return { wall: 0, counter: 0, node };
}

export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  if (a.node !== b.node) return a.node < b.node ? -1 : 1;
  return 0;
}

/** The clock for a new local event at physical time `now`. */
export function tickHlc(local: Hlc, now: number): Hlc {
  if (now > local.wall) return { wall: now, counter: 0, node: local.node };
  return after(local.wall, local.counter, local.node);
}

/**
 * The clock after observing `remote` at physical time `now`. Refuses a remote clock more than
 * `maxSkewMs` ahead of `now`, so one phone with a wrong date cannot win every merge forever.
 */
export function receiveHlc(local: Hlc, remote: Hlc, now: number, maxSkewMs: number): Hlc {
  if (remote.wall - now > maxSkewMs) {
    throw new ClockSkewError(
      `clock of ${remote.node} is ${remote.wall - now} ms ahead (limit ${maxSkewMs} ms)`,
    );
  }
  const wall = Math.max(local.wall, remote.wall, now);
  if (wall === local.wall && wall === remote.wall) {
    return after(wall, Math.max(local.counter, remote.counter), local.node);
  }
  if (wall === local.wall) return after(wall, local.counter, local.node);
  if (wall === remote.wall) return after(wall, remote.counter, local.node);
  return { wall, counter: 0, node: local.node };
}

/** `wall:counter:node`, with the counter zero-padded to 5 digits. */
export function encodeHlc(h: Hlc): string {
  return `${h.wall}:${String(h.counter).padStart(5, '0')}:${h.node}`;
}

export function decodeHlc(s: string): Hlc {
  const m = /^(\d{1,16}):(\d{5}):([A-Za-z0-9_-]{1,64})$/.exec(s);
  if (!m) throw new Error(`malformed hlc "${s}"`);
  const wall = Number(m[1]);
  if (!Number.isSafeInteger(wall)) throw new Error(`hlc wall out of range in "${s}"`);
  return { wall, counter: Number(m[2]), node: m[3]! };
}

export function assertNode(node: string): void {
  if (!NODE_PATTERN.test(node)) {
    throw new Error(`node id must match ${NODE_PATTERN}, got "${node}"`);
  }
}

/** The smallest clock after (wall, counter): a full counter rolls into the next millisecond. */
function after(wall: number, counter: number, node: string): Hlc {
  if (counter >= MAX_COUNTER) return { wall: wall + 1, counter: 0, node };
  return { wall, counter: counter + 1, node };
}
