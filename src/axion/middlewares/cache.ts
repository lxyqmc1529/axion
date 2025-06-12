import { CacheManager } from '../core/Cache';
import { base64Encode } from '../utils';
import type { MiddlewareFunction, MiddlewareContext, MiddlewareNext } from '../types/middleware';

export const createCacheMiddleware = (cacheManager: CacheManager): MiddlewareFunction => ({
  name: 'cache',
  priority: 10,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    const cacheConfig = context.config.cache;

    // 如果没有启用缓存，直接执行下一个中间件
    if (!cacheConfig || (typeof cacheConfig === 'object' && !cacheConfig.enabled)) {
      return next();
    }

    // 只缓存 GET 请求
    if (context.config.method?.toUpperCase() !== 'GET') {
      return next();
    }

    const cacheKey = generateCacheKey(context.config);
    const cachedData = await cacheManager.get(cacheKey);
    
    if (cachedData !== null) {
      context.fromCache = true;
      console.debug('[Axion Cache] 缓存命中：', cacheKey);
      return cachedData;
    }
    console.debug('[Axion Cache] 缓存未命中：', cacheKey);

    // 执行请求
    const result = await next();

    // 缓存成功的响应
    const isSuccessful = context.response?.status >= 200 && context.response?.status < 300;
    if (isSuccessful && result !== undefined) {
      const ttl = typeof cacheConfig === 'object' ? cacheConfig.ttl : undefined;
      await cacheManager.set(cacheKey, result, ttl);
    }

    return result;
  },
});

function generateCacheKey(config: any): string {
  const { method = 'GET', url = '', params = {}, data = {} } = config;

  // 如果有自定义缓存键生成器，使用它
  if (config.cache && typeof config.cache === 'object' && config.cache.keyGenerator) {
    const key = config.cache.keyGenerator(config);
    console.debug('[Axion Cache] 使用自定义键生成器生成键：', key);
    return key;
  }

  // 默认键生成逻辑
  const key = `${method.toUpperCase()}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  console.debug('[Axion Cache] 使用默认键生成器生成键：', key);
  return key;
}

