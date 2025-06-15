import { CacheManager } from '../core/Cache';
import { generateRequestId } from '../utils';
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

    // 生成缓存键
    let cacheKey: string;
    if (typeof cacheConfig === 'object' && cacheConfig.keyGenerator) {
      cacheKey = cacheConfig.keyGenerator(context.config);
      console.debug('[Axion Cache] 使用自定义键生成器生成键：', cacheKey);
    } else {
      // 使用简单的键格式用于测试兼容性
      const { method = 'GET', url = '', params = {}, data = {} } = context.config;
      cacheKey = `${method.toUpperCase()}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
    }
    
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData !== null) {
      context.fromCache = true;
      console.debug('[Axion Cache] 缓存命中：', cacheKey);
      return cachedData;
    }
    console.debug('[Axion Cache] 缓存未命中：', cacheKey);

    // 执行请求
    const result = await next();

    // 缓存成功的响应
    const status = context.response?.status;
    const isSuccessful = status && status >= 200 && status < 300;
    if (isSuccessful && result !== undefined) {
      const ttl = typeof cacheConfig === 'object' ? cacheConfig.ttl : undefined;
      await cacheManager.set(cacheKey, result, ttl);
    }

    return result;
  },
});

