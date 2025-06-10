import type {
  MiddlewareFunction,
  MiddlewareContext,
  MiddlewareNext,
  MiddlewareManager
} from '../types/middleware';

export class MiddlewareEngine implements MiddlewareManager {
  private middlewares: MiddlewareFunction[] = [];

  use(middleware: MiddlewareFunction): void {
    // 检查是否已存在同名中间件
    const existingIndex = this.middlewares.findIndex(m => m.name === middleware.name);
    if (existingIndex !== -1) {
      this.middlewares[existingIndex] = middleware;
    } else {
      this.middlewares.push(middleware);
    }

    // 按优先级排序（数字越小优先级越高）
    this.middlewares.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  }

  remove(name: string): void {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
    }
  }

  getMiddlewares(): MiddlewareFunction[] {
    return [...this.middlewares];
  }

  async execute(context: MiddlewareContext): Promise<any> {
    // 过滤掉被跳过的中间件
    const skipMiddlewares = context.config.middleware?.skip || [];
    const activeMiddlewares = this.middlewares.filter(
      m => !skipMiddlewares.includes(m.name)
    );

    if (activeMiddlewares.length === 0) {
      // 如果没有中间件，直接执行请求
      return this.executeRequest(context);
    }

    let index = 0;

    const next: MiddlewareNext = async () => {
      if (index >= activeMiddlewares.length) {
        // 所有中间件都执行完毕，执行实际请求
        return this.executeRequest(context);
      }

      const middleware = activeMiddlewares[index++];
      return middleware.handler(context, next);
    };

    return next();
  }

  private executeRequest: (context: MiddlewareContext) => Promise<any> = async () => {
    throw new Error('Request executor not set');
  };

  setRequestExecutor(executor: (context: MiddlewareContext) => Promise<any>): void {
    this.executeRequest = executor;
  }
}

// 内置中间件工厂函数
export const createRetryMiddleware = (
  defaultRetryTimes: number = 3,
  defaultDelay: number = 1000
): MiddlewareFunction => ({
  name: 'retry',
  priority: 90,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    const retryConfig = context.config.retry;
    if (!retryConfig) {
      return next();
    }

    const maxRetries = retryConfig.times || defaultRetryTimes;
    const delay = retryConfig.delay || defaultDelay;
    const condition = retryConfig.condition || (() => true);

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        context.retryCount = attempt;
        const result = await next();
        return result;
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !condition(error)) {
          throw error;
        }

        // 等待后重试
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  },
});

export const createCacheMiddleware = (): MiddlewareFunction => ({
  name: 'cache',
  priority: 10,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    // 缓存逻辑将在 Service 类中实现
    return next();
  },
});

export const createErrorHandlerMiddleware = (): MiddlewareFunction => ({
  name: 'errorHandler',
  priority: 100,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    try {
      const result = await next();

      // 检查自定义错误验证
      if (context.config.validateError && context.response) {
        const isError = context.config.validateError(context.response);
        if (isError) {
          throw new Error('Custom validation failed');
        }
      }

      return result;
    } catch (error) {
      context.error = error;
      throw error;
    }
  },
});

export const createTimingMiddleware = (): MiddlewareFunction => ({
  name: 'timing',
  priority: 1,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    context.startTime = Date.now();

    try {
      const result = await next();
      const duration = Date.now() - context.startTime;

      // 可以在这里添加性能监控逻辑
      // @ts-ignore
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Request completed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - context.startTime;
      // @ts-ignore
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Request failed in ${duration}ms`);
      }
      throw error;
    }
  },
});
