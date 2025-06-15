import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRetryMiddleware } from '../retry';
import type { MiddlewareContext } from '../../types/middleware';
import { AxiosError } from 'axios';

describe('Retry Middleware', () => {
  let context: MiddlewareContext;

  beforeEach(() => {
    vi.useFakeTimers();
    context = {
      config: {
        method: 'GET',
        url: '/test',
        retry: {
          times: 3,
          delay: 1000
        }
      },
      startTime: Date.now()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('成功请求不应该触发重试', async () => {
    const middleware = createRetryMiddleware();
    const next = vi.fn().mockResolvedValue('success');

    const result = await middleware.handler(context, next);

    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('应该在失败后重试指定次数', async () => {
    const middleware = createRetryMiddleware();
    const error = new Error('Network Error');
    const next = vi.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const promise = middleware.handler(context, next);
    
    // 等待第一次重试
    await vi.advanceTimersByTimeAsync(1000);
    // 等待第二次重试
    await vi.advanceTimersByTimeAsync(1000);
    
    const result = await promise;
    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(3);
  });

test('应该在所有重试失败后抛出错误', async () => {
  const middleware = createRetryMiddleware();
  // 创建一个网络错误
  const error = new Error('Network Error');
  error.code = 'NETWORK_ERROR';
  const next = vi.fn().mockRejectedValue(error);

  const promise = middleware.handler(context, next);
  
  // 等待所有重试
  await vi.advanceTimersByTimeAsync(1000);
  await vi.advanceTimersByTimeAsync(2000);
  await vi.advanceTimersByTimeAsync(4000);
  
  await expect(promise).rejects.toThrow(error);
  expect(next).toHaveBeenCalledTimes(4); // 初始请求 + 3次重试
});

test('应该遵循线性退避策略', async () => {
  context.config.retry!.backoff = 'linear';
  const middleware = createRetryMiddleware();
  
  // 创建网络错误
  const error = new Error('Network Error');
  error.code = 'NETWORK_ERROR';
  
  const next = vi.fn().mockRejectedValue(error);

  const promise = middleware.handler(context, next);

  // 检查第一次重试的延迟 (1000ms)
  await vi.advanceTimersByTimeAsync(1000);
  expect(next).toHaveBeenCalledTimes(2);

  // 检查第二次重试的延迟 (2000ms)
  await vi.advanceTimersByTimeAsync(2000);
  expect(next).toHaveBeenCalledTimes(3);

  // 检查第三次重试的延迟 (3000ms)
  await vi.advanceTimersByTimeAsync(3000);
  expect(next).toHaveBeenCalledTimes(4);

  await expect(promise).rejects.toThrow(error);
});

  test('应该遵循指数退避策略', async () => {
    context.config.retry!.backoff = 'exponential';
    const middleware = createRetryMiddleware();
    const error = new Error('Network Error');
    error.code = 'NETWORK_ERROR';
    const next = vi.fn().mockRejectedValue(error);

    const promise = middleware.handler(context, next);

    // 检查第一次重试的延迟 (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(next).toHaveBeenCalledTimes(2);

    // 检查第二次重试的延迟 (2000ms)
    await vi.advanceTimersByTimeAsync(2000);
    expect(next).toHaveBeenCalledTimes(3);

    // 检查第三次重试的延迟 (4000ms)
    await vi.advanceTimersByTimeAsync(4000);
    expect(next).toHaveBeenCalledTimes(4);

    await expect(promise).rejects.toThrow(error);
  });

 test('应该调用重试回调', async () => {
  const onRetry = vi.fn();
  const middleware = createRetryMiddleware({ onRetry });
  const error = new Error('Network Error');
  error.code = 'NETWORK_ERROR';
  const next = vi.fn().mockRejectedValue(error);

  const promise = middleware.handler(context, next);
  
  // 正确的指数退避延迟
  await vi.advanceTimersByTimeAsync(1000); // 第1次重试
  await vi.advanceTimersByTimeAsync(2000); // 第2次重试
  await vi.advanceTimersByTimeAsync(4000); // 第3次重试
  
  await expect(promise).rejects.toThrow(error);
  expect(onRetry).toHaveBeenCalledTimes(3);
  expect(onRetry).toHaveBeenCalledWith(error, 1);
  expect(onRetry).toHaveBeenCalledWith(error, 2);
  expect(onRetry).toHaveBeenCalledWith(error, 3);
});

  test('应该根据条件判断是否重试', async () => {
    const condition = vi.fn().mockReturnValue(false);
    const middleware = createRetryMiddleware({ condition });
     const error = new Error('Network Error');
  error.code = 'NETWORK_ERROR';
    const next = vi.fn().mockRejectedValue(error);

    await expect(middleware.handler(context, next)).rejects.toThrow(error);
    expect(next).toHaveBeenCalledTimes(1); // 不应该重试
    expect(condition).toHaveBeenCalledWith(error);
  });

  test('应该正确处理网络错误', async () => {
    const middleware = createRetryMiddleware();
    const networkError = new AxiosError(
      'Network Error',
      'NETWORK_ERROR'
    );
    const next = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('success');

    const promise = middleware.handler(context, next);
    
    // 等待第一次重试
    await vi.advanceTimersByTimeAsync(1000);
    
    const result = await promise;
    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(2);
  });

  test('应该正确处理服务器错误', async () => {
    const middleware = createRetryMiddleware();
    const serverError = new AxiosError(
      'Internal Server Error',
      'EREQUEST',
      context.config,
      {},
      { status: 500 } as any
    );
    const next = vi.fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValue('success');

    const promise = middleware.handler(context, next);
    
    // 等待第一次重试
    await vi.advanceTimersByTimeAsync(1000);
    
    const result = await promise;
    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(2);
  });

  test('没有重试配置时应该直接执行', async () => {
    const contextWithoutRetry = {
      config: {
        method: 'GET',
        url: '/test'
      },
      startTime: Date.now()
    } as MiddlewareContext;
    
    const middleware = createRetryMiddleware();
    const next = vi.fn().mockResolvedValue('success');

    const result = await middleware.handler(contextWithoutRetry, next);

    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('重试次数为0时应该直接执行', async () => {
    const contextWithZeroRetry = {
      config: {
        method: 'GET',
        url: '/test',
        retry: {
          times: 0,
          delay: 1000
        }
      },
      startTime: Date.now()
    } as MiddlewareContext;
    
    const middleware = createRetryMiddleware();
    const next = vi.fn().mockResolvedValue('success');

    const result = await middleware.handler(contextWithZeroRetry, next);

    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('应该正确设置retryCount', async () => {
    const middleware = createRetryMiddleware();
     const error = new Error('Network Error');
  error.code = 'NETWORK_ERROR';
    const next = vi.fn()
      .mockRejectedValueOnce(error)
      .mockImplementation(() => {
        // 检查retryCount是否正确设置
        expect(context.retryCount).toBeGreaterThanOrEqual(0);
        return Promise.resolve('success');
      });

    const promise = middleware.handler(context, next);
    
    // 等待第一次重试
    await vi.advanceTimersByTimeAsync(1000);
    
    const result = await promise;
    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(2);
  });

  test('应该正确处理不可重试的错误', async () => {
    const middleware = createRetryMiddleware();
    const clientError = new AxiosError(
      'Bad Request',
      'EREQUEST',
      context.config,
      {},
      { status: 400 } as any
    );
    const next = vi.fn().mockRejectedValue(clientError);

    await expect(middleware.handler(context, next)).rejects.toThrow(clientError);
    expect(next).toHaveBeenCalledTimes(1); // 不应该重试
  });

  test('应该正确处理429错误（可重试）', async () => {
    const middleware = createRetryMiddleware();
    const rateLimitError = new AxiosError(
      'Too Many Requests',
      'EREQUEST',
      context.config,
      {},
      { status: 429 } as any
    );
    const next = vi.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('success');

    const promise = middleware.handler(context, next);
    
    // 等待第一次重试
    await vi.advanceTimersByTimeAsync(1000);
    
    const result = await promise;
    expect(result).toBe('success');
    expect(next).toHaveBeenCalledTimes(2);
  });

  test('应该使用默认配置', async () => {
    const defaultConfig = {
      delay: 500,
      backoff: 'linear' as const,
      onRetry: vi.fn()
    };
    
    const contextWithMinimalConfig = {
      config: {
        method: 'GET',
        url: '/test',
        retry: {
          times: 2
        }
      },
      startTime: Date.now()
    } as MiddlewareContext;
    
    const middleware = createRetryMiddleware(defaultConfig);
     const error = new Error('Network Error');
  error.code = 'NETWORK_ERROR';
    const next = vi.fn().mockRejectedValue(error);

    const promise = middleware.handler(contextWithMinimalConfig, next);
    
    // 等待第一次重试（使用默认延迟500ms）
    await vi.advanceTimersByTimeAsync(500);
    // 等待第二次重试（线性退避：1000ms）
    await vi.advanceTimersByTimeAsync(1000);
    
    await expect(promise).rejects.toThrow(error);
    expect(next).toHaveBeenCalledTimes(3); // 初始请求 + 2次重试
    expect(defaultConfig.onRetry).toHaveBeenCalledTimes(2);
  });
});