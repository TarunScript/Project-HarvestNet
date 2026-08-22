/**
 * Cache layer — Firestore + Redis with 1500ms fallback rule.
 *
 * Every external API call races against CACHE_FALLBACK_TIMEOUT_MS (Section 7.1).
 * If a live call exceeds the timeout, the system serves data from the warmed
 * cache instead (Section 4.1, Section 14 — Risk mitigation).
 *
 * Architecture:
 *   Redis  → hot cache, sub-200ms reads (Section 11)
 *   Firestore → persistent warm cache, real-time sync
 *
 * @see Section 4.1  — Data flow: "served from warmed cache if a live call exceeds 1500ms"
 * @see Section 11   — Data & cache: Cloud Firestore + Redis (warmed)
 * @see Section 14   — Risk: external API latency/quota drops
 */

export interface CacheLayer {
  /**
   * Get a cached value by key.
   * Checks Redis (hot) first, then Firestore (warm).
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a cached value. Writes to both Redis and Firestore.
   * @param ttlSeconds Time-to-live for the Redis entry (Firestore entries persist).
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Race a live API call against the cache fallback timeout.
   *
   * If the live call resolves within timeoutMs, its result is
   * returned AND written to cache. If it exceeds timeoutMs,
   * the cached value is returned instead.
   *
   * @param key Cache key for this data
   * @param liveFn The live API call function
   * @param timeoutMs Fallback timeout (defaults to CACHE_FALLBACK_TIMEOUT_MS)
   */
  raceWithCache<T>(
    key: string,
    liveFn: () => Promise<T>,
    timeoutMs?: number
  ): Promise<{ data: T; source: 'live' | 'cache' }>;
}

// In-memory store as Redis/Firestore stand-in for local development
interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number | null;
  updatedAt: string;
}

/**
 * Creates the cache layer.
 *
 * In production, this would connect to Redis (REDIS_URL) and
 * Firestore (FIRESTORE_PROJECT_ID). For local development,
 * an in-memory implementation is used with the same interface.
 */
export function createCacheLayer(): CacheLayer {
  // In-memory cache for development — production would use Redis + Firestore
  const store = new Map<string, CacheEntry>();
  const DEFAULT_TTL_SECONDS = 3600; // 1 hour
  const DEFAULT_TIMEOUT_MS = parseInt(
    process.env.CACHE_FALLBACK_TIMEOUT_MS || '1500',
    10
  );

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;

      // Check expiry
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }

      return entry.value as T;
    },

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
      store.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
        updatedAt: new Date().toISOString(),
      });
    },

    async raceWithCache<T>(
      key: string,
      liveFn: () => Promise<T>,
      timeoutMs?: number
    ): Promise<{ data: T; source: 'live' | 'cache' }> {
      const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

      // Try to get cached value for potential fallback
      const cachedValue = await this.get<T>(key);

      // Race the live call against the timeout
      const livePromise = liveFn().then(async (result) => {
        // On success, update the cache
        await this.set(key, result);
        return { data: result, source: 'live' as const };
      });

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeout);
      });

      // Race: live call vs. timeout
      const result = await Promise.race([livePromise, timeoutPromise]);

      if (result !== null) {
        return result;
      }

      // Timeout hit — fall back to cache if available
      if (cachedValue !== null) {
        console.warn(
          `[cache] Live call for "${key}" exceeded ${timeout}ms, serving from cache`
        );
        return { data: cachedValue, source: 'cache' };
      }

      // No cache available — must wait for live call
      console.warn(
        `[cache] Live call for "${key}" exceeded ${timeout}ms, no cache available — waiting for live result`
      );
      return livePromise;
    },
  };
}
