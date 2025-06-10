import type { RequestConfig } from '../types/service';

export interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  abortController: AbortController;
}

export class RequestLockManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private debounceMap = new Map<string, number>();
  private debounceDelay: number;

  constructor(debounceDelay: number = 300) {
    this.debounceDelay = debounceDelay;
  }

  /**
   * 检查是否存在重复请求，如果存在则返回现有的 Promise
   */
  checkDuplicateRequest(config: RequestConfig): Promise<any> | null {
    if (!config.requestLock) {
      return null;
    }

    const key = this.generateRequestKey(config);
    const pending = this.pendingRequests.get(key);

    if (pending) {
      return pending.promise;
    }

    return null;
  }

  /**
   * 注册新的请求
   */
  registerRequest(config: RequestConfig, promise: Promise<any>): Promise<any> {
    const key = this.generateRequestKey(config);
    const abortController = new AbortController();

    const pendingRequest: PendingRequest = {
      promise,
      timestamp: Date.now(),
      abortController,
    };

    this.pendingRequests.set(key, pendingRequest);

    // 请求完成后清理
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });

    return promise;
  }

  /**
   * 防抖处理
   */
  async debounceRequest<T>(
    config: RequestConfig,
    executor: () => Promise<T>
  ): Promise<T> {
    if (!config.debounce) {
      return executor();
    }

    const key = this.generateRequestKey(config);

    return new Promise((resolve, reject) => {
      // 清除之前的定时器
      const existingTimer = this.debounceMap.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 设置新的定时器
      const timer = setTimeout(async () => {
        this.debounceMap.delete(key);
        try {
          const result = await executor();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, this.debounceDelay);

      this.debounceMap.set(key, timer);
    });
  }

  /**
   * 取消指定请求
   */
  cancelRequest(requestId: string): boolean {
    for (const [key, pending] of this.pendingRequests) {
      if (key.includes(requestId)) {
        pending.abortController.abort();
        this.pendingRequests.delete(key);
        return true;
      }
    }
    return false;
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    for (const [key, pending] of this.pendingRequests) {
      pending.abortController.abort();
    }
    this.pendingRequests.clear();

    // 清除所有防抖定时器
    for (const timer of this.debounceMap.values()) {
      clearTimeout(timer);
    }
    this.debounceMap.clear();
  }

  /**
   * 获取待处理请求统计
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      debounceRequests: this.debounceMap.size,
    };
  }

  /**
   * 清理过期的请求
   */
  cleanup(maxAge: number = 30000): void {
    const now = Date.now();

    for (const [key, pending] of this.pendingRequests) {
      if (now - pending.timestamp > maxAge) {
        pending.abortController.abort();
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * 生成请求唯一键
   */
  private generateRequestKey(config: RequestConfig): string {
    const { method = 'GET', url = '', params = {}, data = {} } = config;

    // 如果有自定义 requestId，使用它
    if (config.requestId) {
      return config.requestId;
    }

    // 否则根据请求参数生成
    const key = `${method.toUpperCase()}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
    return this.base64Encode(key).replace(/[+/=]/g, '');
  }

  private base64Encode(str: string): string {
    if (typeof btoa !== 'undefined') {
      return btoa(str);
    } else if (typeof (globalThis as any).Buffer !== 'undefined') {
      return (globalThis as any).Buffer.from(str).toString('base64');
    } else {
      return str.replace(/./g, (char) => char.charCodeAt(0).toString(36)).replace(/\s/g, '');
    }
  }

  /**
   * 更新防抖延迟时间
   */
  setDebounceDelay(delay: number): void {
    this.debounceDelay = delay;
  }
}
