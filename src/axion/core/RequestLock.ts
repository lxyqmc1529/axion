import { generateRequestId } from '../utils';
import type { RequestConfig } from '../types/service';
export interface PendingRequest {
  promise: Promise<any>;
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
    const key = config.requestId || generateRequestId(config)
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
    const key = config.requestId || generateRequestId(config);
    const abortController = new AbortController();

    const pendingRequest: PendingRequest = {
      promise,
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

    const key = config.requestId || generateRequestId(config);
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
    for (const [_, pending] of this.pendingRequests) {
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
   * 更新防抖延迟时间
   */
  setDebounceDelay(delay: number): void {
    this.debounceDelay = delay;
  }
}
