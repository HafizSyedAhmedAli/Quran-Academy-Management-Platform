type Entry = { count: number; resetAt: number };

export function createRateLimiter(opts: { max: number; windowMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry>();

  const live = (key: string): Entry | undefined => {
    const e = entries.get(key);
    if (!e) return undefined;
    if (e.resetAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return e;
  };

  return {
    isBlocked: (key: string) => (live(key)?.count ?? 0) >= opts.max,
    recordFailure(key: string) {
      const e = live(key);
      if (e) e.count += 1;
      else entries.set(key, { count: 1, resetAt: now() + opts.windowMs });
    },
    reset(key: string) {
      entries.delete(key);
    },
  };
}
