import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface CustomAdapter {
  (config: AxiosRequestConfig): Promise<AxiosResponse>;
  name?: string;
  platform?: 'web' | 'node' | 'miniprogram' | 'react-native' | 'custom';
}

export interface AdapterConfig {
  // 适配器名称
  name: string;
  
  // 适配器平台
  platform: string;
  
  // 是否为默认适配器
  isDefault?: boolean;
  
  // 适配器优先级
  priority?: number;
  
  // 适配器条件检查函数
  condition?: () => boolean;
}

export interface AdapterManager {
  register(adapter: CustomAdapter, config?: AdapterConfig): void;
  unregister(name: string): void;
  getAdapter(name?: string): CustomAdapter | undefined;
  getDefaultAdapter(): CustomAdapter | undefined;
  listAdapters(): AdapterConfig[];
}
