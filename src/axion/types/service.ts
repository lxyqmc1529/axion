import type { AxiosRequestConfig, AxiosResponse, AxiosAdapter } from 'axios';
import type { CacheConfig } from './cache';
import type { MiddlewareFunction } from './middleware';
import type { CustomAdapter } from './adapter';
import type { RetryConfig } from './retry';

export interface RequestConfig extends AxiosRequestConfig {
  // 重试配置
  retry?: RetryConfig;
  
  // 缓存配置
  cache?: CacheConfig | boolean;
  
  // 请求优先级 (1-10, 10为最高优先级)
  priority?: number;
  
  // 是否启用防抖
  debounce?: boolean;
  
  // 请求锁
  requestLock?: boolean;
  
  // 自定义错误验证
  validateError?: (response: AxiosResponse) => boolean | Error;
  
  // 请求标识符，用于防抖和请求锁
  requestId?: string;
  
  // 中间件配置
  middleware?: {
    skip?: string[]; // 跳过的中间件名称
  };
}

export interface ServiceConfig {
  // 基础 axios 配置
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  
  // 默认重试配置
  defaultRetry?: RetryConfig;
  
  // 默认缓存配置
  defaultCache?: CacheConfig;
  
  // 默认优先级
  defaultPriority?: number;
  
  // 全局错误验证函数
  globalValidateError?: (response: AxiosResponse) => boolean | Error;
  
  // 自定义适配器
  adapter?: AxiosAdapter | CustomAdapter;
  
  // 是否开启调度
  enableSchedule?: boolean;

  // 并发请求数限制
  maxConcurrentRequests?: number;
  
  // 请求队列大小限制
  maxQueueSize?: number;
}

export interface RequestTask {
  id: string;
  config: RequestConfig;
  priority: number;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  controller: AbortController;
}

export interface ServiceInstance {
  request<T = any>(config: RequestConfig): Promise<T>;
  get<T = any>(url: string, config?: RequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<T>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  head<T = any>(url: string, config?: RequestConfig): Promise<T>;
  options<T = any>(url: string, config?: RequestConfig): Promise<T>;
  
  // 中间件管理
  use(middleware: MiddlewareFunction): void;
  removeMiddleware(name: string): void;
  
  // 缓存管理
  clearCache(pattern?: string): void;
  getCacheStats(): { size: number; maxSize: number; hitRate: number };
  
  // 请求管理
  cancelRequest(requestId: string): void;
  cancelAllRequests(): void;
  getQueueStats(): {
    pending: number
    running: number;
    maxConcurrent: number;
    maxQueueSize: number;
  } | null;
  
  // 适配器管理
  setAdapter(adapter: AxiosAdapter | CustomAdapter): void;
}
