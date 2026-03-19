// Simple TTL-based in-memory cache for video metadata
// Prevents hammering yt-dlp for the same URL repeatedly

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MetadataCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    // Auto-cleanup every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000).unref();
  }

  set<T>(key: string, data: T): void {
    // Evict the soonest-to-expire entry when at capacity
    if (this.store.size >= this.maxEntries) {
      let oldest: string | null = null;
      let oldestExp = Infinity;
      for (const [k, v] of this.store) {
        if (v.expiresAt < oldestExp) { oldestExp = v.expiresAt; oldest = k; }
      }
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) this.store.delete(k);
    }
  }

  get size(): number { return this.store.size; }
}

// Preview cache: 10 min TTL, up to 500 entries
export const previewCache = new MetadataCache(10 * 60 * 1000, 500);

// Full info cache: 8 min TTL, up to 200 entries
export const infoCache = new MetadataCache(8 * 60 * 1000, 200);
