// 主要导出
export { Service } from './core/Service';
export { CacheManager, MemoryLRUCache } from './core/Cache';
export { RequestQueue } from './core/RequestQueue';
export { MiddlewareEngine } from './core/Middleware';
export { RequestLockManager } from './core/RequestLock';

// 类型导出
export * from './types';

// 适配器导出
export * from './adapters';

// 中间件导出
export * from './middlewares';

// 工具函数导出
export * from './utils';

// 创建默认实例的工厂函数
import { Service } from './core/Service';
import type { ServiceConfig } from './types/service';

/**
 * 创建 Axion 服务实例
 */
export function createAxion(config?: ServiceConfig): Service {
  return new Service(config);
}

/**
 * 创建默认的 Axion 实例
 */
export const axion = createAxion();

// 便捷方法
export const request = axion.request.bind(axion);
export const get = axion.get.bind(axion);
export const post = axion.post.bind(axion);
export const put = axion.put.bind(axion);
export const del = axion.delete.bind(axion);
export const patch = axion.patch.bind(axion);
export const head = axion.head.bind(axion);
export const options = axion.options.bind(axion);

// 默认导出
export default axion;
