import type { MiddlewareFunction, MiddlewareContext, MiddlewareNext } from '../types/middleware';

export interface RetryConfig {
  times: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  condition?: (error: any) => boolean;
  onRetry?: (error: any, retryCount: number) => void;
}

export const createRetryMiddleware = (defaultConfig?: Partial<RetryConfig>): MiddlewareFunction => ({
  name: 'retry',
  priority: 90,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    const retryConfig = context.config.retry;
    if (!retryConfig || retryConfig.times <= 0) {
      return next();
    }
    
    const config: RetryConfig = {
      times: retryConfig.times,
      delay: retryConfig.delay ?? defaultConfig?.delay ?? 1000,
      backoff: retryConfig.backoff ?? defaultConfig?.backoff ?? 'exponential',
      condition: retryConfig.condition ?? defaultConfig?.condition ?? isRetryableError,
      onRetry: retryConfig.onRetry ?? defaultConfig?.onRetry,
    };
    
    let lastError: any;
    
    // 初始尝试
    try {
      context.retryCount = 0;
      return await next();
    } catch (error) {
      lastError = error;
      if (!config.condition(error)) {
        throw error;
      }
    }
    
    // 重试逻辑
    for (let attempt = 1; attempt <= config.times; attempt++) {
      try {
        // 计算延迟时间并等待
        const delay = calculateDelay(config.delay, attempt - 1, config.backoff);
        if (delay > 0) {
          await sleep(delay);
        }

        // 调用重试回调
        if (config.onRetry) {
          config.onRetry(lastError, attempt);
        }

        context.retryCount = attempt;
        return await next();
      } catch (error) {
        lastError = error;
        if (!config.condition(error)) {
          throw error;
        }
        // 如果是最后一次重试且失败，抛出错误
        if (attempt === config.times) {
          throw error;
        }
      }
    }
    
    throw lastError;
  },
});

function isRetryableError(error: any): boolean {
  // 网络错误
  if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
    return true;
  }
  
  // 超时错误
  if (error.code === 'ECONNRESET' || error.message?.includes('timeout')) {
    return true;
  }
  
  // HTTP 状态码错误
  if (error.response?.status) {
    const status = error.response.status;
    // 5xx 服务器错误和部分 4xx 错误可以重试
    return status >= 500 || status === 408 || status === 429;
  }
  
  return false;
}

function calculateDelay(baseDelay: number, attempt: number, backoff: 'linear' | 'exponential'): number {
  let delay: number;
  switch (backoff) {
    case 'linear':
      delay = baseDelay * (attempt + 1);
      break;
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt);
      break;
    default:
      delay = baseDelay;
  }
  return Math.min(delay, 30000); // 设置最大延迟时间为30秒
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
