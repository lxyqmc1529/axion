import type { MiddlewareFunction, MiddlewareContext, MiddlewareNext } from '../types/middleware';
import { AxiosError } from 'axios';

export interface ErrorHandlerConfig {
  logErrors?: boolean;
  onError?: (error: any, context: MiddlewareContext) => void;
  transformError?: (error: any, context: MiddlewareContext) => any;
}

export const createErrorHandlerMiddleware = (config?: ErrorHandlerConfig): MiddlewareFunction => ({
  name: 'errorHandler',
  priority: 100,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    try {
      const result = await next();
      
      // 检查自定义错误验证
      if (context.response && typeof context.config.validateError === 'function') {
        const validationResult = context.config.validateError(context.response);
        if (validationResult === true || (validationResult && typeof validationResult === 'object')) {
          const errorMessage = typeof validationResult === 'object' && validationResult.message
            ? validationResult.message
            : 'Custom validation failed';
          throw new CustomValidationError(errorMessage, context.response);
        }
      }
      
      return result;
    } catch (error) {
      context.error = error;
      
      // 记录错误
      if (config?.logErrors !== false) {
        logError(error, context);
      }
      
      // 调用错误回调
      if (config?.onError) {
        config.onError(error, context);
      }
      
      // 转换错误
      const finalError = config?.transformError ? config.transformError(error, context) : error;
      
      // 包装错误以提供更多信息
      throw finalError instanceof Error ? finalError : wrapError(finalError, context);
    }
  },
});

export class CustomValidationError extends Error {
  public response: any;
  public isCustomValidationError = true;
  
  constructor(message: string, response: any) {
    super(message);
    this.name = 'CustomValidationError';
    this.response = response;
  }
}

export class AxionError extends Error {
  public isAxionError = true;
  public context: MiddlewareContext;
  public originalError: any;
  
  constructor(message: string, context: MiddlewareContext, originalError?: any) {
    super(message);
    this.name = 'AxionError';
    this.context = context;
    this.originalError = originalError;
  }
}

function logError(error: any, context: MiddlewareContext): void {
  const { config, startTime } = context;
  const duration = Date.now() - startTime;
  
  console.group(`🚨 Axion Request Error`);
  console.error(`URL: ${config.method?.toUpperCase()} ${config.url}`);
  console.error(`Duration: ${duration}ms`);
  
  if (context.retryCount !== undefined) {
    console.error(`Retry Count: ${context.retryCount}`);
  }
  
  if (isAxiosError(error)) {
    console.error(`Status: ${error.response?.status}`);
    console.error(`Status Text: ${error.response?.statusText}`);
    console.error(`Response Data:`, error.response?.data);
  }
  
  console.error(`Error:`, error);
  console.groupEnd();
}

function wrapError(error: any, context: MiddlewareContext): AxionError {
  if (error instanceof AxionError) {
    return error;
  }
  
  let message = 'Request failed';
  
  if (isAxiosError(error)) {
    if (error.response) {
      message = `Request failed with status ${error.response.status}`;
    } else if (error.request) {
      message = 'Request failed - no response received';
    } else {
      message = `Request failed - ${error.message}`;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }
  
  return new AxionError(message, context, error);
}

function isAxiosError(error: any): error is AxiosError {
  return error && error.isAxiosError === true;
}

// 预定义错误处理器
export const createNetworkErrorHandler = (): MiddlewareFunction => ({
  name: 'networkErrorHandler',
  priority: 90,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    try {
      return await next();
    } catch (error) {
      if (isAxiosError(error) && (error.code === 'ENETWORK' || error.code === 'ENOTFOUND')) {
        throw new AxionError('Network error - please check your connection', context, error);
      }
      throw error;
    }
  },
});

export const createTimeoutErrorHandler = (): MiddlewareFunction => ({
  name: 'timeoutErrorHandler',
  priority: 90,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    try {
      return await next();
    } catch (error) {
      if (isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new AxionError('Request timeout - please try again', context, error);
      }
      throw error;
    }
  },
});

export const createServerErrorHandler = (): MiddlewareFunction => ({
  name: 'serverErrorHandler',
  priority: 90,
  handler: async (context: MiddlewareContext, next: MiddlewareNext) => {
    try {
      return await next();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status && error.response.status >= 500) {
        throw new AxionError('Server error - please try again later', context, error);
      }
      throw error;
    }
  },
});
