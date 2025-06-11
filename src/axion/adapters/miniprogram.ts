import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { CustomAdapter } from '../types/adapter';

// 小程序适配器
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