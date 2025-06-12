import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MiddlewareEngine } from '../Middleware';
import type { MiddlewareFunction, MiddlewareContext } from '../../types/middleware';

describe('MiddlewareEngine', () => {
  let engine: MiddlewareEngine;
  let mockContext: MiddlewareContext;

  beforeEach(() => {
    engine = new MiddlewareEngine();
    mockContext = {
      config: {},
      startTime: Date.now(),
    };
  });

  test('应该能够添加中间件', () => {
    const middleware: MiddlewareFunction = {
      name: 'test',
      handler: async (ctx, next) => next(),
    };

    engine.use(middleware);
    expect(engine.getMiddlewares()).toHaveLength(1);
    expect(engine.getMiddlewares()[0]).toBe(middleware);
  });

  test('添加同名中间件应该覆盖原有中间件', () => {
    const middleware1: MiddlewareFunction = {
      name: 'test',
      handler: async (ctx, next) => next(),
    };

    const middleware2: MiddlewareFunction = {
      name: 'test',
      handler: async (ctx, next) => next(),
    };

    engine.use(middleware1);
    engine.use(middleware2);
    expect(engine.getMiddlewares()).toHaveLength(1);
    expect(engine.getMiddlewares()[0]).toBe(middleware2);
  });

  test('应该按优先级排序中间件', () => {
    const middleware1: MiddlewareFunction = {
      name: 'test1',
      priority: 2,
      handler: async (ctx, next) => next(),
    };

    const middleware2: MiddlewareFunction = {
      name: 'test2',
      priority: 1,
      handler: async (ctx, next) => next(),
    };

    engine.use(middleware1);
    engine.use(middleware2);
    expect(engine.getMiddlewares()[0].name).toBe('test2');
    expect(engine.getMiddlewares()[1].name).toBe('test1');
  });

  test('应该能够移除中间件', () => {
    const middleware: MiddlewareFunction = {
      name: 'test',
      handler: async (ctx, next) => next(),
    };

    engine.use(middleware);
    engine.remove('test');
    expect(engine.getMiddlewares()).toHaveLength(0);
  });

  test('应该按顺序执行中间件', async () => {
    const order: string[] = [];
    const middleware1: MiddlewareFunction = {
      name: 'test1',
      handler: async (ctx, next) => {
        order.push('before1');
        await next();
        order.push('after1');
      },
    };

    const middleware2: MiddlewareFunction = {
      name: 'test2',
      handler: async (ctx, next) => {
        order.push('before2');
        await next();
        order.push('after2');
      },
    };

    engine.use(middleware1);
    engine.use(middleware2);

    const mockExecutor = vi.fn().mockResolvedValue('result');
    engine.setRequestExecutor(mockExecutor);

    await engine.execute(mockContext);

    expect(order).toEqual(['before1', 'before2', 'after2', 'after1']);
    expect(mockExecutor).toHaveBeenCalledTimes(1);
  });

  test('应该跳过被指定跳过的中间件', async () => {
    const middleware1: MiddlewareFunction = {
      name: 'test1',
      handler: vi.fn().mockImplementation((ctx, next) => next()),
    };

    const middleware2: MiddlewareFunction = {
      name: 'test2',
      handler: vi.fn().mockImplementation((ctx, next) => next()),
    };

    engine.use(middleware1);
    engine.use(middleware2);

    mockContext.config.middleware = { skip: ['test1'] };
    const mockExecutor = vi.fn().mockResolvedValue('result');
    engine.setRequestExecutor(mockExecutor);

    await engine.execute(mockContext);

    expect(middleware1.handler).not.toHaveBeenCalled();
    expect(middleware2.handler).toHaveBeenCalled();
  });

  test('中间件出错时应该停止执行并抛出错误', async () => {
    const error = new Error('Middleware error');
    const middleware1: MiddlewareFunction = {
      name: 'test1',
      handler: async (ctx, next) => {
        throw error;
      },
    };

    const middleware2: MiddlewareFunction = {
      name: 'test2',
      handler: vi.fn().mockImplementation((ctx, next) => next()),
    };

    engine.use(middleware1);
    engine.use(middleware2);

    const mockExecutor = vi.fn().mockResolvedValue('result');
    engine.setRequestExecutor(mockExecutor);

    await expect(engine.execute(mockContext)).rejects.toThrow(error);
    expect(middleware2.handler).not.toHaveBeenCalled();
    expect(mockExecutor).not.toHaveBeenCalled();
  });
});