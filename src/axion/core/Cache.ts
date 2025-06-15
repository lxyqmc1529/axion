import type {
  CacheConfig,
  CacheItem,
  CacheStats,
  LRUCache
} from '../types/cache';

export class MemoryLRUCache<K, V> implements LRUCache<K, V> {
  private cache = new Map<K, V>();
  private accessOrder = new Map<K, number>();
  private accessCounter = 0;

  constructor(public readonly maxSize: number = 100) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.accessOrder.set(key, ++this.accessCounter);
      return;
    }

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  delete(key: K): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let lruKey: K | undefined;
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.delete(lruKey);
    }
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }

  entries(): [K, V][] {
    return Array.from(this.cache.entries());
  }
}

export class CacheManager {
  private cache: LRUCache<string, CacheItem>;
  private config: Required<CacheConfig>;
  private stats: CacheStats;

  constructor(config: CacheConfig = {}) {
    this.config = {
      ttl: config.ttl ?? 5 * 60 * 1000, // 5分钟
      maxSize: config.maxSize ?? 100,
    };

    this.cache = new MemoryLRUCache<string, CacheItem>(this.config.maxSize);
    this.stats = {
      size: 0,
      maxSize: this.config.maxSize,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      keys: []
    };
  }

  get(key: string) {
    // 检查缓存是否启用
  if (this.config.enabled === false) {
    return null;
  }
    const item = this.cache.get(key);
    if (!item) {
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.missCount++;
      this.updateHitRate();
      this.stats.size = this.cache.size;
      return null;
    }

    item.accessCount++;
    item.lastAccessed = now;
    this.stats.hitCount++;
    this.updateHitRate();

    return item.data;
  }

  set(key: string, data: any, ttl?: number) {
    // 检查缓存是否启用
    if (this.config.enabled === false) {
      return;
    }
    const now = Date.now();
    const item: CacheItem = {
      data,
      timestamp: now,
      ttl: ttl ?? this.config.ttl,
      accessCount: 1,
      lastAccessed: now,
    };

    this.cache.set(key, item);
    this.stats.size = this.cache.size;
  }

  delete(key: string) {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  clear() {
    this.cache.clear();
    this.stats.size = 0;
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      keys: this.cache.keys(),
    };
  }

  updateConfig(config: Partial<CacheConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    this.cache.maxSize = config.maxSize || oldConfig.maxSize;
    // 如果 TTL 改变，更新所有现有缓存项的 TTL
    if (config.ttl && config.ttl !== oldConfig.ttl) {
      const entries = this.cache.entries()
      for (const [key, item] of entries) {
        const remainingTime = item.ttl - (Date.now() - item.timestamp);
        if (remainingTime > 0) {
          item.ttl = config.ttl;
          this.cache.set(key, item);
        } else {
          this.cache.delete(key);
        }
      }
      this.stats.size = this.cache.size;
    }
  }

  destroy(): void {
    this.clear();
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }
}
