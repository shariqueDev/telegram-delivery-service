/**
 * In-memory idempotency store (no Redis). Suitable for single-instance / local runs.
 */
export function createIdempotencyStore(ttlMs: number) {
  const map = new Map<string, { at: number; payload: Record<string, unknown> }>();

  function prune(): void {
    const now = Date.now();
    const cutoff = now - ttlMs;
    for (const [k, v] of map.entries()) {
      if (v.at < cutoff) map.delete(k);
    }
  }

  const interval = setInterval(prune, Math.min(300_000, ttlMs / 2));
  if (interval.unref) interval.unref();

  return {
    get(key: string): Record<string, unknown> | null {
      if (!key) return null;
      prune();
      const row = map.get(key);
      if (!row) return null;
      if (Date.now() - row.at > ttlMs) {
        map.delete(key);
        return null;
      }
      return row.payload;
    },

    set(key: string, payload: Record<string, unknown>): void {
      if (!key) return;
      map.set(key, { at: Date.now(), payload });
    },
  };
}

export type IdempotencyStore = ReturnType<typeof createIdempotencyStore>;
