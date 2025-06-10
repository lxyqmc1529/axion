import type { RequestConfig } from '../types/service';

/**
 * 生成请求的唯一标识符
 */
export function generateRequestId(config: RequestConfig): string {
  const { method = 'GET', url = '', params = {}, data = {} } = config;
  const key = `${method.toUpperCase()}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  return base64Encode(key).replace(/[+/=]/g, '') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Base64 编码（兼容浏览器和 Node.js）
 */
export function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  } else if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(str).toString('base64');
  } else {
    // 简单的 base64 编码实现
    return str.replace(/./g, (char) => char.charCodeAt(0).toString(36)).replace(/\s/g, '');
  }
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key] as T[keyof T]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * 检查是否为对象
 */
export function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * 检查是否为空对象
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * 格式化 URL
 */
export function formatUrl(baseUrl: string, url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = url.startsWith('/') ? url : `/${url}`;

  return base + path;
}

/**
 * 序列化查询参数
 */
export function serializeParams(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, String(item)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams.toString();
}

/**
 * 解析错误信息
 */
export function parseErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.message) {
    return error.message;
  }

  return 'Unknown error occurred';
}

/**
 * 检查是否为浏览器环境
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * 检查是否为 Node.js 环境
 */
export function isNode(): boolean {
  // @ts-ignore
  return typeof process !== 'undefined' && process.versions?.node;
}

/**
 * 检查是否为小程序环境
 */
export function isMiniProgram(): boolean {
  // @ts-ignore
  return typeof wx !== 'undefined' && wx.request;
}

/**
 * 获取当前时间戳
 */
export function now(): number {
  return Date.now();
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建可取消的 Promise
 */
export function createCancelablePromise<T>(
  executor: (resolve: (value: T) => void, reject: (reason: any) => void) => void
): { promise: Promise<T>; cancel: () => void } {
  let isCanceled = false;
  let cancelCallback: (() => void) | undefined;

  const promise = new Promise<T>((resolve, reject) => {
    cancelCallback = () => {
      isCanceled = true;
      reject(new Error('Promise was cancelled'));
    };

    executor(
      (value) => {
        if (!isCanceled) {
          resolve(value);
        }
      },
      (reason) => {
        if (!isCanceled) {
          reject(reason);
        }
      }
    );
  });

  return {
    promise,
    cancel: () => {
      if (cancelCallback) {
        cancelCallback();
      }
    },
  };
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    times: number;
    delay?: number;
    condition?: (error: any) => boolean;
  }
): Promise<T> {
  const { times, delay: delayMs = 1000, condition = () => true } = options;

  let lastError: any;

  for (let i = 0; i <= times; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i === times || !condition(error)) {
        throw error;
      }

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}
