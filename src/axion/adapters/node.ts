import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { CustomAdapter } from '../types/adapter';

// Node.js 适配器
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