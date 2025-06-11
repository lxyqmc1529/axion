import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { CustomAdapter } from '../types/adapter';

// React Native 适配器
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