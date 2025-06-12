import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCacheMiddleware } from '../cache';
import { CacheManager } from '../../core/Cache';
import type { MiddlewareContext } from '../../types/middleware';

describe('Cache Middleware', () => {
  let cacheManager: CacheManager;
  let context: MiddlewareContext;
  let consoleSpy: any;

  beforeEach(() => {
    cacheManager = new CacheManager({
      enabled: true,
      ttl: 1000,
      maxSize: 100
    });

    context = {
      config: {
        method: 'GET',
        url: '/test',
        params: { id: 1 },
        cache: { enabled: true }
      },
      startTime: Date.now()
    };

    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    cacheManager.destroy();
  });


  test('非GET请求不应该使用缓存', async () => {
    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('result');
    context.config.method = 'POST';

    const result = await middleware.handler(context, next);

    expect(result).toBe('result');
    expect(next).toHaveBeenCalledTimes(1);
    const stats = cacheManager.getStats();
    expect(stats.hitCount).toBe(0);
    expect(stats.missCount).toBe(0);
  });

  test('禁用缓存时不应该使用缓存', async () => {
    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('result');
    context.config.cache = { enabled: false };

    const result = await middleware.handler(context, next);

    expect(result).toBe('result');
    expect(next).toHaveBeenCalledTimes(1);
    const stats = cacheManager.getStats();
    expect(stats.hitCount).toBe(0);
    expect(stats.missCount).toBe(0);
  });

  test('缓存命中时应该返回缓存数据', async () => {
    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('new result');
    const cacheKey = `GET:${context.config.url}:${JSON.stringify(context.config.params)}:{}`;

    // 先设置缓存
    await cacheManager.set(cacheKey, 'cached result');

    const result = await middleware.handler(context, next);

    expect(result).toBe('cached result');
    expect(next).not.toHaveBeenCalled();
    expect(context.fromCache).toBe(true);
    const stats = cacheManager.getStats();
    expect(stats.hitCount).toBe(1);
  });

  test('缓存未命中时应该执行请求并缓存结果', async () => {
    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('new result');
    context.response = { status: 200 };
    const cacheKey = `GET:${context.config.url}:${JSON.stringify(context.config.params)}:{}`;

    const result = await middleware.handler(context, next);

    expect(result).toBe('new result');
    expect(next).toHaveBeenCalledTimes(1);
    expect(context.fromCache).toBeUndefined();

    // 验证结果已被缓存
    const cachedResult = await cacheManager.get(cacheKey);
    expect(cachedResult).toBe('new result');
  });

  test('请求失败时不应该缓存结果', async () => {
    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('error result');
    context.response = { status: 500 };
    const cacheKey = `GET:${context.config.url}:${JSON.stringify(context.config.params)}:{}`;

    const result = await middleware.handler(context, next);

    expect(result).toBe('error result');
    expect(next).toHaveBeenCalledTimes(1);

    // 验证结果未被缓存
    const cachedResult = await cacheManager.get(cacheKey);
    expect(cachedResult).toBeNull();
  });

  test('应该使用自定义缓存键生成器', async () => {
    const customKeyGenerator = vi.fn().mockReturnValue('custom-key');
    context.config.cache = {
      enabled: true,
      keyGenerator: customKeyGenerator
    };

    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('result');

    await middleware.handler(context, next);

    expect(customKeyGenerator).toHaveBeenCalledWith(context.config);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Axion Cache] 使用自定义键生成器生成键：',
      'custom-key'
    );
  });

  test('应该使用自定义TTL', async () => {
    const customTTL = 5000;
    context.config.cache = {
      enabled: true,
      ttl: customTTL
    };

    const middleware = createCacheMiddleware(cacheManager);
    const next = vi.fn().mockResolvedValue('result');
    context.response = { status: 200 };

    // 在调用handler之前设置spy
    const setCacheSpy = vi.spyOn(cacheManager, 'set');

    await middleware.handler(context, next);

    // 验证使用了自定义TTL
    expect(setCacheSpy).toHaveBeenCalledWith(
      `GET:${context.config.url}:${JSON.stringify(context.config.params)}:{}`,
      'result',
      customTTL
    );
  });
});