// Stale-While-Revalidate Cache Service
// Returns cached data immediately, refreshes in background

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  refreshing?: boolean;
}

interface CacheOptions {
  /** Time in ms before data is considered stale (default: 2 min) */
  staleTime?: number;
  /** Time in ms before cached data expires completely (default: 1 hour) */
  maxAge?: number;
}

const DEFAULT_STALE_TIME = 2 * 60 * 1000; // 2 minutes
const DEFAULT_MAX_AGE = 60 * 60 * 1000; // 1 hour

class SWRCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private refreshPromises = new Map<string, Promise<unknown>>();

  /**
   * Get data with stale-while-revalidate semantics
   * Returns cached data immediately if available, triggers background refresh if stale
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<{ data: T; fromCache: boolean; isStale: boolean }> {
    const { staleTime = DEFAULT_STALE_TIME, maxAge = DEFAULT_MAX_AGE } = options;
    const now = Date.now();
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    // Check if we have valid cached data
    if (entry) {
      const age = now - entry.timestamp;
      const isExpired = age > maxAge;
      const isStale = age > staleTime;

      // Data is completely expired - must refetch
      if (isExpired) {
        this.cache.delete(key);
      } else {
        // Data is valid (possibly stale) - return it
        if (isStale && !entry.refreshing) {
          // Trigger background refresh
          this.refreshInBackground(key, fetcher, options);
        }
        return { data: entry.data, fromCache: true, isStale };
      }
    }

    // No cache or expired - fetch fresh data
    const data = await fetcher();
    this.set(key, data);
    return { data, fromCache: false, isStale: false };
  }

  /**
   * Get cached data without triggering fetch (sync)
   */
  getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    return entry?.data ?? null;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      refreshing: false,
    });
  }

  /**
   * Invalidate a cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.refreshPromises.clear();
  }

  /**
   * Refresh data in background without blocking
   */
  private refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): void {
    // Check if already refreshing
    if (this.refreshPromises.has(key)) {
      return;
    }

    // Mark as refreshing
    const entry = this.cache.get(key);
    if (entry) {
      entry.refreshing = true;
    }

    // Start background refresh
    const refreshPromise = fetcher()
      .then((data) => {
        this.set(key, data);
        console.log(`[Cache] Background refresh completed: ${key}`);
      })
      .catch((error) => {
        console.warn(`[Cache] Background refresh failed: ${key}`, error);
        // Keep stale data on error
        if (entry) {
          entry.refreshing = false;
        }
      })
      .finally(() => {
        this.refreshPromises.delete(key);
      });

    this.refreshPromises.set(key, refreshPromise);
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { entries: number; refreshing: number } {
    let refreshing = 0;
    for (const entry of this.cache.values()) {
      if ((entry as CacheEntry<unknown>).refreshing) {
        refreshing++;
      }
    }
    return {
      entries: this.cache.size,
      refreshing,
    };
  }
}

// Export singleton instance
export const swrCache = new SWRCache();

// ============== CACHE KEY HELPERS ==============

export const CacheKeys = {
  vault: (id: string) => `vault:${id}`,
  vaultGraph: (id: string) => `vault:${id}:graph`,
  vaultExposures: (id: string) => `vault:${id}:exposures`,
  vaultTvl: (id: string) => `vault:${id}:tvl`,
  protocol: (slug: string) => `protocol:${slug}`,
  protocolTvl: (slug: string) => `protocol:${slug}:tvl`,
  allVaults: () => 'vaults:all',
  liveVaults: () => 'vaults:live',
} as const;

// ============== CACHE TTL PRESETS ==============

export const CacheTTL = {
  /** Fast-changing data like TVL - 2 min stale, 10 min max */
  live: { staleTime: 2 * 60 * 1000, maxAge: 10 * 60 * 1000 },
  /** Graph structure - 5 min stale, 30 min max */
  graph: { staleTime: 5 * 60 * 1000, maxAge: 30 * 60 * 1000 },
  /** Protocol metadata - 15 min stale, 2 hour max */
  protocol: { staleTime: 15 * 60 * 1000, maxAge: 2 * 60 * 60 * 1000 },
  /** Static registry data - 1 hour stale, 24 hour max */
  registry: { staleTime: 60 * 60 * 1000, maxAge: 24 * 60 * 60 * 1000 },
} as const;
