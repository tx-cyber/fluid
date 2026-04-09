// A minimal Redis-backed store compatible with express-rate-limit's expected methods.
// It implements `incr(key, cb)` and `resetKey(key, cb)` using atomic INCR and EXPIRE behavior.
export class RedisRateLimitStore {
  private client: any;
  private windowSeconds: number;

  constructor(client: any, windowSeconds: number) {
    this.client = client;
    this.windowSeconds = windowSeconds;
  }

  // express-rate-limit calls `incr(key, cb)` where cb(err, current) is expected.
  async incr(key: string, cb: (err: Error | null, value?: number) => void) {
    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        // set expiry for the window
        await this.client.expire(key, this.windowSeconds);
      }

      cb(null, Number(count));
    } catch (err: any) {
      cb(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Reset the key for freeing up the limiter (used by express-rate-limit)
  async resetKey(key: string, cb?: (err?: Error | null) => void) {
    try {
      await this.client.del(key);
      cb && cb(null);
    } catch (err: any) {
      cb && cb(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Optional: decrement (not required by express-rate-limit but useful)
  async decrement(key: string) {
    try {
      await this.client.decr(key);
    } catch (err) {
      // ignore
    }
  }
}
