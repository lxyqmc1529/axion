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

// 创建全局适配器注册表
export const globalAdapterRegistry = new AdapterRegistry();
