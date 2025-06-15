export interface CacheConfig {
  // 是否启用缓存
  enabled?: boolean;
  // 缓存时间 (毫秒)
  ttl?: number;
  // 最大缓存数量
  maxSize?: number;
  // 自定义缓存键生成器
  keyGenerator?: (config: any) => string;
}

export interface CacheStorage {
  get(key: string): Promise<CacheItem | null> | CacheItem | null;
  set(key: string, value: CacheItem): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
  keys(): Promise<string[]> | string[];
}

export interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  keys: string[];  // 添加缓存键列表
}

export interface LRUCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): boolean;
  clear(): void;
  has(key: K): boolean;
  size: number;
  maxSize: number;
  keys(): K[];
  entries(): [K, V][];
}
