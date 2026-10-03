/**
 * Token buckets, kept in memory per server process. Each key (a device, a user) gets `burst`
 * requests at once, refilled at `perMinute`. A multi-process deployment limits per process; put a
 * shared limiter at the proxy if that matters.
 */
export interface RateLimit {
  /** Sustained requests per minute (refill rate). */
  perMinute: number;
  /** Requests allowed at once before throttling (bucket size). Defaults to `perMinute`. */
  burst?: number;
}

export class RateLimiter {
  readonly #buckets = new Map<string, { tokens: number; at: number }>();
  readonly #rate: number;
  readonly #burst: number;

  constructor(
    limit: RateLimit,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 100_000,
  ) {
    if (!(limit.perMinute > 0)) throw new Error('rate limit perMinute must be > 0');
    this.#rate = limit.perMinute / 60_000;
    this.#burst = limit.burst ?? limit.perMinute;
  }

  /** Takes one token for `key`. Returns 0 if allowed, otherwise the milliseconds to wait. */
  take(key: string): number {
    const now = this.now();
    let b = this.#buckets.get(key);
    if (!b) {
      if (this.#buckets.size >= this.maxKeys) this.#evict(now);
      b = { tokens: this.#burst, at: now };
      this.#buckets.set(key, b);
    }
    b.tokens = Math.min(this.#burst, b.tokens + (now - b.at) * this.#rate);
    b.at = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - b.tokens) / this.#rate);
  }

  /** Drops buckets that have refilled completely: they behave exactly like new ones. */
  #evict(now: number): void {
    for (const [key, b] of this.#buckets) {
      if (b.tokens + (now - b.at) * this.#rate >= this.#burst) this.#buckets.delete(key);
    }
  }
}
