import { createAxion, Service } from '../index';
import type { MiddlewareFunction } from '../types/middleware';

// 1. 创建基本实例
const axion = createAxion({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  defaultRetry: {
    times: 3,
    delay: 1000,
  },
  defaultCache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5分钟
    maxSize: 100,
  },
  defaultPriority: 5,
  defaultDebounce: true,
  defaultRequestLock: true,
  maxConcurrentRequests: 6,
  maxQueueSize: 100,
});

// 2. 基本使用
async function basicUsage() {
  try {
    // GET 请求
    const users = await axion.get('/users');
    console.log('Users:', users);
    
    // POST 请求
    const newUser = await axion.post('/users', {
      name: 'John Doe',
      email: 'john@example.com',
    });
    console.log('New user:', newUser);
    
    // 带配置的请求
    const data = await axion.request({
      method: 'GET',
      url: '/data',
      priority: 10, // 高优先级
      cache: {
        enabled: true,
        ttl: 10 * 60 * 1000, // 10分钟缓存
      },
      retry: {
        times: 5,
        delay: 2000,
      },
    });
    console.log('Data:', data);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// 3. 自定义中间件
const loggingMiddleware: MiddlewareFunction = {
  name: 'logging',
  priority: 1,
  handler: async (context, next) => {
    console.log(`🚀 Starting request: ${context.config.method?.toUpperCase()} ${context.config.url}`);
    const startTime = Date.now();
    
    try {
      const result = await next();
      const duration = Date.now() - startTime;
      console.log(`✅ Request completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Request failed in ${duration}ms:`, error);
      throw error;
    }
  },
};

// 添加自定义中间件
axion.use(loggingMiddleware);

// 4. 自定义错误验证
async function customErrorValidation() {
  try {
    const response = await axion.get('/api/data', {
      validateError: (response) => {
        // 自定义错误判断逻辑
        return response.data.code !== 0;
      },
    });
    console.log('Response:', response);
  } catch (error) {
    console.error('Custom validation failed:', error);
  }
}

// 5. 请求取消
async function requestCancellation() {
  // 设置请求ID
  const requestId = 'unique-request-id';
  
  // 发起请求
  const promise = axion.get('/slow-api', {
    requestId,
    timeout: 30000,
  });
  
  // 5秒后取消请求
  setTimeout(() => {
    axion.cancelRequest(requestId);
  }, 5000);
  
  try {
    const result = await promise;
    console.log('Result:', result);
  } catch (error) {
    console.log('Request was cancelled or failed:', error);
  }
}

// 6. 缓存管理
function cacheManagement() {
  // 获取缓存统计
  const cacheStats = axion.getCacheStats();
  console.log('Cache stats:', cacheStats);
  
  // 清除特定模式的缓存
  axion.clearCache('users/*');
  
  // 清除所有缓存
  axion.clearCache();
}

// 7. 队列管理
function queueManagement() {
  // 获取队列统计
  const queueStats = axion.getQueueStats();
  console.log('Queue stats:', queueStats);
  
  // 取消所有请求
  axion.cancelAllRequests();
}

// 8. 高级配置示例
const advancedAxion = createAxion({
  baseURL: 'https://api.advanced.com',
  defaultRetry: {
    times: 3,
    delay: 1000,
    condition: (error) => {
      // 只重试网络错误和5xx错误
      return !error.response || error.response.status >= 500;
    },
  },
  defaultCache: {
    enabled: true,
    ttl: 5 * 60 * 1000,
    maxSize: 200,
    keyGenerator: (config) => {
      // 自定义缓存键生成
      return `custom_${config.method}_${config.url}_${JSON.stringify(config.params)}`;
    },
  },
  globalValidateError: (response) => {
    // 全局错误验证
    return response.data.success === false;
  },
  maxConcurrentRequests: 10,
  maxQueueSize: 200,
});

// 9. TypeScript 类型支持示例
interface User {
  id: number;
  name: string;
  email: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function typedRequests() {
  // 带类型的请求
  const users = await axion.get<User[]>('/users');
  console.log('First user:', users[0].name);
  
  // 带响应类型的请求
  const response = await axion.get<ApiResponse<User[]>>('/api/users');
  console.log('API response:', response.data);
}

// 10. 错误处理示例
async function errorHandling() {
  try {
    await axion.get('/non-existent-endpoint');
  } catch (error: any) {
    if (error.isAxionError) {
      console.log('Axion error:', error.message);
      console.log('Request config:', error.context.config);
      console.log('Original error:', error.originalError);
    } else {
      console.log('Other error:', error);
    }
  }
}

// 导出示例函数
export {
  basicUsage,
  customErrorValidation,
  requestCancellation,
  cacheManagement,
  queueManagement,
  typedRequests,
  errorHandling,
};
