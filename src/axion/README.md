# Axion - 强大的 HTTP 请求库

Axion 是基于 Axios 的二次封装，提供了丰富的功能和开箱即用的体验。

## 特性

- 🔄 **智能重试机制** - 支持自定义重试次数、延迟和条件
- 💾 **LRU 缓存系统** - 内置缓存管理，支持 TTL 和自定义缓存逻辑
- 🚫 **请求防抖** - 防止重复请求，提升性能
- ⚡ **优先级调度** - 高优先级请求优先处理
- 🧅 **洋葱中间件** - 类似 Koa 的中间件机制
- 🛡️ **统一错误处理** - 完善的错误处理和自定义验证
- 🔌 **适配器系统** - 支持多平台适配（Web、Node.js、小程序等）
- 🔒 **请求锁机制** - 防止重复请求
- ❌ **请求取消** - 简单的请求取消控制
- 📝 **TypeScript 支持** - 完整的类型定义和智能提示

## 安装

```bash
npm install axion
# 或
yarn add axion
# 或
pnpm add axion
```

## 快速开始

### 基本使用

```typescript
import { createAxion } from 'axion';

// 创建实例
const axion = createAxion({
  baseURL: 'https://api.example.com',
  timeout: 10000,
});

// 发起请求
const users = await axion.get('/users');
const newUser = await axion.post('/users', { name: 'John' });
```

### 高级配置

```typescript
const axion = createAxion({
  baseURL: 'https://api.example.com',
  // 默认重试配置
  defaultRetry: {
    times: 3,
    delay: 1000,
    condition: (error) => error.response?.status >= 500,
  },
  // 默认缓存配置
  defaultCache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5分钟
    maxSize: 100,
  },
  // 请求优先级
  defaultPriority: 5,
  // 防抖
  defaultDebounce: true,
  // 请求锁
  defaultRequestLock: true,
  // 并发控制
  maxConcurrentRequests: 6,
  maxQueueSize: 100,
});
```

## 核心功能

### 1. 重试机制

```typescript
await axion.get('/api/data', {
  retry: {
    times: 5,
    delay: 2000,
    condition: (error) => !error.response || error.response.status >= 500,
  },
});
```

### 2. 缓存系统

```typescript
await axion.get('/api/data', {
  cache: {
    enabled: true,
    ttl: 10 * 60 * 1000, // 10分钟
    keyGenerator: (config) => `custom_${config.url}`,
  },
});
```

### 3. 请求优先级

```typescript
// 高优先级请求
await axion.get('/important-data', { priority: 10 });

// 低优先级请求
await axion.get('/background-data', { priority: 1 });
```

### 4. 中间件系统

```typescript
// 自定义中间件
const loggingMiddleware = {
  name: 'logging',
  priority: 1,
  handler: async (context, next) => {
    console.log('Request started:', context.config.url);
    const result = await next();
    console.log('Request completed');
    return result;
  },
};

axion.use(loggingMiddleware);
```

### 5. 错误处理

```typescript
await axion.get('/api/data', {
  validateError: (response) => {
    return response.data.code !== 0;
  },
});
```

### 6. 请求取消

```typescript
const requestId = 'unique-id';
const promise = axion.get('/slow-api', { requestId });

// 取消特定请求
axion.cancelRequest(requestId);

// 取消所有请求
axion.cancelAllRequests();
```

### 7. 防抖处理

```typescript
// 连续调用只会执行最后一次
await axion.get('/search', { 
  debounce: true,
  params: { q: 'keyword' }
});
```

### 8. 请求锁

```typescript
// 重复请求会返回同一个 Promise
await axion.get('/user-info', { requestLock: true });
await axion.get('/user-info', { requestLock: true }); // 复用上面的请求
```

## 适配器系统

### 小程序适配器

```typescript
import { createMiniprogramAdapter } from 'axion/adapters';

const axion = createAxion({
  adapter: createMiniprogramAdapter(),
});
```

### React Native 适配器

```typescript
import { createReactNativeAdapter } from 'axion/adapters';

const axion = createAxion({
  adapter: createReactNativeAdapter(),
});
```

## TypeScript 支持

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// 带类型的请求
const users = await axion.get<User[]>('/users');
const user = await axion.post<User>('/users', { name: 'John' });
```

## API 参考

### Service 类

#### 方法

- `request<T>(config: RequestConfig): Promise<T>`
- `get<T>(url: string, config?: RequestConfig): Promise<T>`
- `post<T>(url: string, data?: any, config?: RequestConfig): Promise<T>`
- `put<T>(url: string, data?: any, config?: RequestConfig): Promise<T>`
- `delete<T>(url: string, config?: RequestConfig): Promise<T>`
- `patch<T>(url: string, data?: any, config?: RequestConfig): Promise<T>`
- `head<T>(url: string, config?: RequestConfig): Promise<T>`
- `options<T>(url: string, config?: RequestConfig): Promise<T>`

#### 中间件管理

- `use(middleware: MiddlewareFunction): void`
- `removeMiddleware(name: string): void`

#### 缓存管理

- `clearCache(pattern?: string): void`
- `getCacheStats(): CacheStats`

#### 请求管理

- `cancelRequest(requestId: string): void`
- `cancelAllRequests(): void`
- `getQueueStats(): QueueStats`

### 配置选项

详细的配置选项请参考 TypeScript 类型定义。

## 许可证

MIT License
