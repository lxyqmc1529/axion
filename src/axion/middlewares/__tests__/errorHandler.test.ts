import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  createErrorHandlerMiddleware,
  createNetworkErrorHandler,
  createTimeoutErrorHandler,
  createServerErrorHandler,
  CustomValidationError,
  AxionError
} from '../errorHandler';
import type { MiddlewareContext } from '../../types/middleware';
import { AxiosError } from 'axios';

describe('ErrorHandler Middleware', () => {
  let context: MiddlewareContext;
  let consoleSpy: any;

  beforeEach(() => {
    context = {
      config: {
        method: 'GET',
        url: '/test'
      },
      startTime: Date.now()
    };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  test('成功请求不应该触发错误处理', async () => {
    const middleware = createErrorHandlerMiddleware();
    const next = vi.fn().mockResolvedValue('success');

    const result = await middleware.handler(context, next);

    expect(result).toBe('success');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test('应该处理自定义错误验证', async () => {
    const middleware = createErrorHandlerMiddleware();
    const next = vi.fn().mockResolvedValue({ status: 'error' });
    context.config.validateError = (response) => response.status === 'error';
    context.response = { status: 'error' };

    await expect(middleware.handler(context, next)).rejects.toThrow(CustomValidationError);
  });

  test('应该记录错误信息', async () => {
    const middleware = createErrorHandlerMiddleware({ logErrors: true });
    const error = new Error('Test error');
    const next = vi.fn().mockRejectedValue(error);

    await expect(middleware.handler(context, next)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('应该调用错误回调', async () => {
    const onError = vi.fn();
    const middleware = createErrorHandlerMiddleware({ onError });
    const error = new Error('Test error');
    const next = vi.fn().mockRejectedValue(error);

    await expect(middleware.handler(context, next)).rejects.toThrow();
    expect(onError).toHaveBeenCalledWith(error, context);
  });

  test('应该转换错误', async () => {
    const transformedError = new Error('Transformed error');
    const middleware = createErrorHandlerMiddleware({
      transformError: () => transformedError
    });
    const next = vi.fn().mockRejectedValue(new Error('Original error'));

    await expect(middleware.handler(context, next)).rejects.toThrow(transformedError);
  });
});

describe('预定义错误处理器', () => {
  let context: MiddlewareContext;

  beforeEach(() => {
    context = {
      config: {
        method: 'GET',
        url: '/test'
      },
      startTime: Date.now()
    };
  });

  test('网络错误处理器应该处理网络错误', async () => {
    const middleware = createNetworkErrorHandler();
    const networkError = new AxiosError(
      'Network Error',
      'ENETWORK',
      context.config
    );
    const next = vi.fn().mockRejectedValue(networkError);

    await expect(middleware.handler(context, next))
      .rejects
      .toThrow('Network error - please check your connection');
  });

  test('超时错误处理器应该处理超时错误', async () => {
    const middleware = createTimeoutErrorHandler();
    const timeoutError = new AxiosError(
      'timeout of 1000ms exceeded',
      'ECONNABORTED',
      context.config
    );
    const next = vi.fn().mockRejectedValue(timeoutError);

    await expect(middleware.handler(context, next))
      .rejects
      .toThrow('Request timeout - please try again');
  });

  test('服务器错误处理器应该处理 500 错误', async () => {
    const middleware = createServerErrorHandler();
    const serverError = new AxiosError(
      'Internal Server Error',
      'EREQUEST',
      context.config,
      {},
      { status: 500, statusText: 'Internal Server Error' } as any
    );
    const next = vi.fn().mockRejectedValue(serverError);

    await expect(middleware.handler(context, next))
      .rejects
      .toThrow('Server error - please try again later');
  });
});

describe('AxionError', () => {
  test('应该正确包装原始错误', () => {
    const context: MiddlewareContext = {
      config: { method: 'GET', url: '/test' },
      startTime: Date.now()
    };
    const originalError = new Error('Original error');
    
    const axionError = new AxionError('Wrapped error', context, originalError);
    
    expect(axionError.isAxionError).toBe(true);
    expect(axionError.context).toBe(context);
    expect(axionError.originalError).toBe(originalError);
  });
});