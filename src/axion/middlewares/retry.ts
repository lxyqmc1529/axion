import type {
  MiddlewareFunction,
  MiddlewareContext,
  MiddlewareNext,
  RetryConfig,
} from '../types';

export const createRetryMiddleware = (defaultConfig?: Partial<RetryConfig>): MiddlewareFunction => ({
  name: 'retry',
  priority: 90,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    const retryConfig = context.config.retry;
    // 检查重试参数
    if (!retryConfig || retryConfig.times <= 0) {
      return next();
    }
    // 组装重试参数
    const config: Required<RetryConfig> = {
      times: retryConfig.times,
      delay: retryConfig.delay ?? defaultConfig?.delay ?? 1000,
      backoff: retryConfig.backoff ?? defaultConfig?.backoff ?? 'exponential',
      condition: retryConfig.condition ?? defaultConfig?.condition ?? isRetryableError,
      onRetry: retryConfig.onRetry ?? defaultConfig?.onRetry as any,
    };
    
    let lastError: any;
    
    const retryAttempt = async (attempt: number): Promise<any> => {
      try {
        // 首次尝试不等待
        if (attempt > 0) {
          // 根据重试次数和延时，以及延时曲线计算重试等待时间
          const delay = calculateDelay(config.delay, attempt - 1, config.backoff);
          if (delay > 0) {
            await sleep(delay);
          }
          config.onRetry?.(lastError, attempt);
        }
        
        context.retryCount = attempt;
        return await next();
      } catch (error) {
        lastError = error;
        // 判断是否继续执行重试: 需要通过自定义的condition判断逻辑，且重试次数小于指定次数
        if (!config.condition(error) || attempt >= config.times) {
          throw error;
        }
        return retryAttempt(attempt + 1);
      }
    };

    return retryAttempt(0);
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
