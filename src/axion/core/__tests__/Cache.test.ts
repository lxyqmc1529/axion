import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CacheManager, MemoryLRUCache } from '../Cache';
import type { CacheConfig } from '../../types/cache';

describe('MemoryLRUCache', () => {
  let cache: MemoryLRUCache<string, any>;

  beforeEach(() => {
    cache = new MemoryLRUCache(3); // 设置较小的容量便于测试
  });

  test('应该能够设置和获取缓存项', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('当缓存满时应该移除最少使用的项', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // 访问 key1 和 key2，使 key3 成为最少使用的
    cache.get('key1');
    cache.get('key2');
    
    // 添加新项，应该移除 key3
    cache.set('key4', 'value4');
    
    expect(cache.has('key3')).toBe(false);
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  test('clear 方法应该清空缓存', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    
    expect(cache.size).toBe(0);
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(false);
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let config: CacheConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    config = {
      ttl: 1000, // 1秒
      maxSize: 100,
      enabled: true
    };
    cacheManager = new CacheManager(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('应该能够设置和获取缓存项', async () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };
    
    await cacheManager.set(key, data);
    const cachedData = await cacheManager.get(key);
    
    expect(cachedData).toEqual(data);
  });

  test('过期的缓存项应该返回 null', async () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };
    
    await cacheManager.set(key, data);
    
    // 前进时间超过 TTL
    vi.advanceTimersByTime(config.ttl + 100);
    
    const cachedData = await cacheManager.get(key);
    expect(cachedData).toBeNull();
  });

  test('禁用缓存时应该返回 null', async () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };
    
    cacheManager.updateConfig({ enabled: false });
    await cacheManager.set(key, data);
    const cachedData = await cacheManager.get(key);
    
    expect(cachedData).toBeNull();
  });

  test('应该正确更新缓存统计信息', async () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };
    
    await cacheManager.set(key, data);
    
    // 命中缓存
    await cacheManager.get(key);
    // 未命中缓存
    await cacheManager.get('non-existent-key');
    
    const stats = cacheManager.getStats();
    expect(stats.hitCount).toBe(1);
    expect(stats.missCount).toBe(1);
    expect(stats.hitRate).toBe(0.5); // 命中率应该是 50%
  });

  test('应该能够删除缓存项', async () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };
    
    await cacheManager.set(key, data);
    await cacheManager.delete(key);
    const cachedData = await cacheManager.get(key);
    
    expect(cachedData).toBeNull();
  });

  test('应该能够清空所有缓存', async () => {
    await cacheManager.set('key1', 'value1');
    await cacheManager.set('key2', 'value2');
    
    await cacheManager.clear();
    
    const stats = cacheManager.getStats();
    expect(stats.size).toBe(0);
    expect(await cacheManager.get('key1')).toBeNull();
    expect(await cacheManager.get('key2')).toBeNull();
  });

  test('应该能够更新配置', async () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };
    const newTtl = 2000;
    
    await cacheManager.set(key, data);
    cacheManager.updateConfig({ ttl: newTtl });
    
    // 前进时间超过原始 TTL 但小于新 TTL
    vi.advanceTimersByTime(config.ttl + 100);
    
    // 数据应该仍然存在
    const cachedData = await cacheManager.get(key);
    expect(cachedData).toEqual(data);
  });
});