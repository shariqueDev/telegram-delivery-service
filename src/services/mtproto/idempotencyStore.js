/**
 * In-memory idempotency store (no Redis). Suitable for single-instance / local runs.
 */
export function createIdempotencyStore(ttlMs) {
  /** @type {Map<string, { at: number, payload: Record<string, unknown> }>} */
  const map = new Map();

  function prune() {
    const now = Date.now();
    const cutoff = now - ttlMs;
    for (const [k, v] of map.entries()) {
      if (v.at < cutoff) map.delete(k);
    }
  }

  const interval = setInterval(prune, Math.min(300_000, ttlMs / 2));
  if (interval.unref) interval.unref();

  return {
    /**
     * @param {string} key
     * @returns {Record<string, unknown> | null}
     */
    get(key) {
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

    /**
     * @param {string} key
     * @param {Record<string, unknown>} payload
     */
    set(key, payload) {
      if (!key) return;
      map.set(key, { at: Date.now(), payload });
    },
  };
}
