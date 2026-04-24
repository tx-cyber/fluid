import type { Store, IncrementResponse } from "express-rate-limit";

/**
 * A Redis-backed store implementing the express-rate-limit v6 `Store` interface.
 * Uses atomic INCR + EXPIRE for safe distributed rate limiting.
 */
export class RedisRateLimitStore implements Store {
  private client: any;
  private windowSeconds: number;

  constructor(client: any, windowSeconds: number) {
    this.client = client;
    this.windowSeconds = windowSeconds;
  }

  /**
   * express-rate-limit v6 async Store interface.
   * Returns { totalHits, resetTime }.
   */
  async increment(key: string): Promise<IncrementResponse> {
    const count: number = await this.client.incr(key);

    if (count === 1) {
      // First increment — set the window expiry
      await this.client.expire(key, this.windowSeconds);
    }

    const ttl: number = await this.client.ttl(key);
    const resetTime = new Date(Date.now() + ttl * 1000);

    return { totalHits: count, resetTime };
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.client.decr(key);
    } catch {
      // ignore — decrement is best-effort
    }
  }

  async resetKey(key: string): Promise<void> {
    await this.client.del(key);
  }
}
