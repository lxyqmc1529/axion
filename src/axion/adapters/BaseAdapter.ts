import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { CustomAdapter, AdapterConfig, AdapterManager } from '../types/adapter';

export class AdapterRegistry implements AdapterManager {
  private adapters = new Map<string, { adapter: CustomAdapter; config: AdapterConfig }>();
  private defaultAdapter?: CustomAdapter;

  register(adapter: CustomAdapter, config?: AdapterConfig): void {
    const adapterConfig: AdapterConfig = {
      name: config?.name || adapter.name || 'unnamed',
      platform: config?.platform || adapter.platform || 'unknown',
      isDefault: config?.isDefault || false,
      priority: config?.priority || 0,
      condition: config?.condition,
    };

    this.adapters.set(adapterConfig.name, { adapter, config: adapterConfig });

    if (adapterConfig.isDefault) {
      this.defaultAdapter = adapter;
    }
  }

  unregister(name: string): void {
    const entry = this.adapters.get(name);
    if (entry && entry.adapter === this.defaultAdapter) {
      this.defaultAdapter = undefined;
    }
    this.adapters.delete(name);
  }

  getAdapter(name?: string): CustomAdapter | undefined {
    if (name) {
      return this.adapters.get(name)?.adapter;
    }

    // 如果没有指定名称，返回最适合的适配器
    return this.getBestAdapter();
  }

  getDefaultAdapter(): CustomAdapter | undefined {
    return this.defaultAdapter;
  }

  listAdapters(): AdapterConfig[] {
    return Array.from(this.adapters.values()).map(entry => entry.config);
  }

  private getBestAdapter(): CustomAdapter | undefined {
    if (this.defaultAdapter) {
      return this.defaultAdapter;
    }

    // 根据条件和优先级选择最佳适配器
    const candidates = Array.from(this.adapters.values())
      .filter(entry => !entry.config.condition || entry.config.condition())
      .sort((a, b) => (b.config.priority || 0) - (a.config.priority || 0));

    return candidates[0]?.adapter;
  }
}

// 小程序适配器示例
export const createMiniprogramAdapter = (): CustomAdapter => {
  const adapter: CustomAdapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    return new Promise((resolve, reject) => {
      // 检查是否在小程序环境
      if (typeof globalThis !== 'undefined' && !(globalThis as any).wx) {
        reject(new Error('Not in miniprogram environment'));
        return;
      }

      const wx = (globalThis as any).wx;
      const { url, method = 'GET', data, headers, timeout } = config;

      wx.request({
        url: url || '',
        method: method.toUpperCase() as any,
        data,
        header: headers,
        timeout,
        success: (res: any) => {
          const response: AxiosResponse = {
            data: res.data,
            status: res.statusCode,
            statusText: res.statusCode === 200 ? 'OK' : 'Error',
            headers: res.header,
            config: config as InternalAxiosRequestConfig,
            request: {},
          };
          resolve(response);
        },
        fail: (error: any) => {
          reject(error);
        },
      });
    });
  };

  adapter.name = 'miniprogram';
  adapter.platform = 'miniprogram';

  return adapter;
};

// React Native 适配器示例
export const createReactNativeAdapter = (): CustomAdapter => {
  const adapter: CustomAdapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const { url, method = 'GET', data, headers, timeout } = config;

    const fetchConfig: RequestInit = {
      method: method.toUpperCase(),
      headers: headers as HeadersInit,
      body: data ? JSON.stringify(data) : undefined,
      signal: config.signal as AbortSignal | undefined,
    };

    if (timeout) {
      const controller = new AbortController();
      // 显式标记为未使用
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      void timeoutId; 

      fetchConfig.signal = controller.signal;
    }

    try {
      const response = await fetch(url || '', fetchConfig);
      const responseData = await response.json();

      const axiosResponse: AxiosResponse = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config: config as InternalAxiosRequestConfig,
        request: {},
      };

      return axiosResponse;
    } catch (error) {
      throw error;
    }
  };

  adapter.name = 'react-native';
  adapter.platform = 'react-native';

  return adapter;
};

// Node.js 适配器示例
export const createNodeAdapter = (): CustomAdapter => {
  const adapter: CustomAdapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    // 这里可以使用 Node.js 的 http/https 模块
    // 或者直接使用 axios 的默认适配器
    try {
      // @ts-ignore
      const axios = require('axios');
      return await axios.request(config);
    } catch (error) {
      throw error;
    }
  };

  adapter.name = 'node';
  adapter.platform = 'node';

  return adapter;
};

// 创建全局适配器注册表
export const globalAdapterRegistry = new AdapterRegistry();
