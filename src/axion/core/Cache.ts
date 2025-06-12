import { generateRequestId } from '../utils';
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
}

export class CacheManager {
  private cache: LRUCache<string, CacheItem>;
  private config: Required<CacheConfig>;
  private stats: CacheStats;
  private cleanupTimer?: number;

  constructor(config: CacheConfig = {}) {
    this.config = {
      ttl: config.ttl ?? 5 * 60 * 1000, // 5分钟
      maxSize: config.maxSize ?? 100,
      keyGenerator: config.keyGenerator ?? generateRequestId,
      enabled: config.enabled ?? true,
      storage: config.storage ?? 'memory',
      customStorage: config.customStorage ?? null as any,
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

    this.startCleanupTimer();
  }

  async get(key: string): Promise<any | null> {
    if (!this.config.enabled) {
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
      return null;
    }

    item.accessCount++;
    item.lastAccessed = now;
    this.stats.hitCount++;
    this.updateHitRate();

    return item.data;
  }

  async set(key: string, data: any, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
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

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      this.stats.size = 0;
      return;
    }

    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    // 由于 LRUCache 接口没有提供遍历方法，我们需要扩展实现
    // 这里简化处理，实际实现中可能需要更复杂的逻辑
    this.cache.clear(); // 临时简化实现
    this.stats.size = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats,
      keys: this.cache.keys(),
     };
  }

  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.maxSize && config.maxSize !== this.cache.maxSize) {
      // 重新创建缓存以应用新的大小限制
      const oldCache = this.cache;
      this.cache = new MemoryLRUCache<string, CacheItem>(config.maxSize);
      // 这里可以添加迁移逻辑
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次过期缓存
  }

  private cleanup(): void {
    const now = Date.now();
    // 由于接口限制，这里简化实现
    // 实际实现中需要遍历所有缓存项并删除过期的
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}
