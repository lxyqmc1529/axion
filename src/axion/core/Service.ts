import axios, { type AxiosInstance, type AxiosResponse, type AxiosAdapter } from 'axios';
import type { ServiceConfig, RequestConfig, ServiceInstance } from '../types/service';
import type { MiddlewareFunction, MiddlewareContext } from '../types/middleware';
import type { CustomAdapter } from '../types/adapter';
import { CacheManager } from './Cache';
import { RequestQueue } from './RequestQueue';
import { MiddlewareEngine, createRetryMiddleware, createErrorHandlerMiddleware, createTimingMiddleware } from './Middleware';
import { RequestLockManager } from './RequestLock';
import { createCacheMiddleware } from '../middlewares/cache';
import { createRetryMiddleware as createAdvancedRetryMiddleware } from '../middlewares/retry';
import { createErrorHandlerMiddleware as createAdvancedErrorHandlerMiddleware } from '../middlewares/errorHandler';
import { generateRequestId } from '../utils';

export class Service implements ServiceInstance {
  private axiosInstance: AxiosInstance;
  private config: Required<ServiceConfig>;
  private cacheManager: CacheManager;
  private requestQueue: RequestQueue;
  private middlewareEngine: MiddlewareEngine;
  private requestLockManager: RequestLockManager;

  constructor(config: ServiceConfig = {}) {
    this.config = this.mergeDefaultConfig(config);

    // 初始化 axios 实例
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers,
      adapter: this.config.adapter as AxiosAdapter,
    });

    // 初始化各个管理器
    this.cacheManager = new CacheManager(this.config.defaultCache);
    this.requestQueue = new RequestQueue(
      this.config.maxConcurrentRequests,
      this.config.maxQueueSize
    );
    this.middlewareEngine = new MiddlewareEngine();
    this.requestLockManager = new RequestLockManager();

    // 设置请求执行器
    this.requestQueue.setRequestExecutor(this.executeRequest.bind(this));
    this.middlewareEngine.setRequestExecutor(this.executeAxiosRequest.bind(this));

    this.setupDefaultMiddlewares();
  }

  // HTTP 方法
  async request<T = any>(config: RequestConfig): Promise<T> {
    const mergedConfig = this.mergeRequestConfig(config);

    // 检查重复请求
    if (mergedConfig.requestLock) {
      const duplicatePromise = this.requestLockManager.checkDuplicateRequest(mergedConfig);
      if (duplicatePromise) {
          return duplicatePromise;
      }
      // 先注册一个新的 Promise
      return this.requestLockManager.registerRequest(mergedConfig, new Promise((resolve, reject) => {
        this.processRequest(mergedConfig).then(resolve).catch(reject);
      }));
    }

    // 防抖处理
    if (mergedConfig.debounce) {
      return this.requestLockManager.debounceRequest(mergedConfig, () =>
        this.processRequest(mergedConfig)
      );
    }

    return this.processRequest(mergedConfig);
  }

  async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async head<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'HEAD', url });
  }

  async options<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'OPTIONS', url });
  }

  // 中间件管理
  use(middleware: MiddlewareFunction): void {
    this.middlewareEngine.use(middleware);
  }

  removeMiddleware(name: string): void {
    this.middlewareEngine.remove(name);
  }

  // 缓存管理
  clearCache(pattern?: string): void {
    this.cacheManager.clear(pattern);
  }

  getCacheStats() {
    return this.cacheManager.getStats();
  }

  // 请求管理
  private abortControllers = new Map<string, AbortController>();

  cancelRequest(requestId: string): void {
    // Cancel queue position
    this.requestQueue.cancel(requestId);
    
    // Cancel active request
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
    
    // Cancel request lock
    this.requestLockManager.cancelRequest(requestId);
  }

  cancelAllRequests(): void {
    this.requestQueue.cancelAll();
    this.requestLockManager.cancelAllRequests();
  }

  getQueueStats() {
    return this.requestQueue.getStats();
  }

  updateQueueConfig(maxConcurrent?: number, maxQueueSize?: number): void {
    this.requestQueue.updateConfig(maxConcurrent, maxQueueSize);
  }

  // 适配器管理
  setAdapter(adapter: AxiosAdapter | CustomAdapter): void {
    this.axiosInstance.defaults.adapter = adapter as AxiosAdapter;
  }

  private async processRequest<T>(config: RequestConfig): Promise<T> {
    // 检查缓存
    if (config.cache) {
      const cacheKey = generateRequestId(config);
      const cachedData = await this.cacheManager.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    // 使用请求队列处理
    return this.requestQueue.add(config);
}

  private async executeRequest(config: RequestConfig): Promise<any> {
    const context: MiddlewareContext = {
      config,
      startTime: Date.now(),
    };

    return this.middlewareEngine.execute(context);
  }

  private async executeAxiosRequest(context: MiddlewareContext): Promise<any> {
    const controller = new AbortController();
    const requestId = context.config.requestId!;
    this.abortControllers.set(requestId, controller);
    
    try {
      const response: AxiosResponse = await this.axiosInstance.request({
        ...context.config,
        signal: controller.signal
      });

      // Cleanup after successful request
      this.abortControllers.delete(requestId);
      context.response = response;

      // 缓存响应
      if (context.config.cache && response.status >= 200 && response.status < 300) {
        const cacheKey = generateRequestId(context.config);
        const ttl = typeof context.config.cache === 'object' ? context.config.cache.ttl : undefined;
        await this.cacheManager.set(cacheKey, response.data, ttl);
      }

      return response.data;
    } catch (error) {
      // Convert AbortError to CanceledError
      if (axios.isCancel(error)) {
        const canceledError = new Error(`Request ${requestId} was canceled`);
        canceledError.name = 'CanceledError';
        context.error = canceledError;
        throw canceledError;
      }
      
      context.error = error;
      throw error;
    } finally {
      // Ensure cleanup
      this.abortControllers.delete(requestId);
    }
  }

  private mergeDefaultConfig(config: ServiceConfig): Required<ServiceConfig> {
    return {
      baseURL: config.baseURL || '',
      timeout: config.timeout || 10000,
      headers: config.headers || {},
      defaultRetry: config.defaultRetry || { times: 0 },
      defaultCache: config.defaultCache || { enabled: false },
      defaultPriority: config.defaultPriority || 5,
      defaultDebounce: config.defaultDebounce || false,
      defaultRequestLock: config.defaultRequestLock || false,
      globalValidateError: config.globalValidateError || (() => false),
      adapter: (config.adapter as AxiosAdapter) || axios.defaults.adapter!,
      maxConcurrentRequests: config.maxConcurrentRequests || 6,
      maxQueueSize: config.maxQueueSize || 100,
    };
  }

  private mergeRequestConfig(config: RequestConfig): RequestConfig & { requestId?: string } {
    return {
      ...config,
      requestId: config.requestId,  // 只使用用户提供的 requestId
      retry: config.retry || this.config.defaultRetry,
      cache: config.cache !== undefined ? config.cache : this.config.defaultCache,
      priority: config.priority || this.config.defaultPriority,
      debounce: config.debounce !== undefined ? config.debounce : this.config.defaultDebounce,
      requestLock: config.requestLock !== undefined ? config.requestLock : this.config.defaultRequestLock,
      validateError: config.validateError || this.config.globalValidateError,
    };
  }

  private setupDefaultMiddlewares(): void {
    // 添加默认中间件（按执行顺序）
    this.use(createTimingMiddleware());
    this.use(createCacheMiddleware(this.cacheManager));
    this.use(createAdvancedRetryMiddleware());
    this.use(createAdvancedErrorHandlerMiddleware({
      logErrors: true,
    }));
  }
}
