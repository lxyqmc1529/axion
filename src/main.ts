import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// 导入并测试 axion
import { createAxion } from './axion'

// 创建 axion 实例
const axion = createAxion({
  baseURL: 'https://jsonplaceholder.typicode.com',
  defaultCache: {
    enabled: true,
    ttl: 30000,
  },
  defaultRetry: {
    times: 2,
    delay: 1000,
  },
});

// 独立测试用例运行器
async function runTestCase(name: string, testFn: () => Promise<void>) {
  try {
    await testFn();
    console.log(`✅ ${name} passed`);
  } catch (error) {
    console.error(`❌ ${name} failed:`, error);
  }
}

async function testAxion() {
  console.log('🧪 Starting Axion test suite...');

  // 1. 基础请求测试
  await runTestCase('Basic GET request', async () => {
    const posts = await axion.get('/posts?_limit=3');
    console.log('📨 Received posts:', posts.length);
  });

  // 2. 缓存测试
  await runTestCase('Cache performance', async () => {
    const testEndpoint = async (url: string) => {
      const firstStart = Date.now();
      await axion.get(url, { cache: true });
      const firstTime = Date.now() - firstStart;

      const secondStart = Date.now();
      await axion.get(url, { cache: true });
      const secondTime = Date.now() - secondStart;
      
      console.log(`⏱️ ${url} response times: ${firstTime}ms → ${secondTime}ms`);
      if (secondTime >= firstTime) {
        throw new Error('Cache not working properly');
      }
    };

    await testEndpoint('/posts/1');
    await testEndpoint('/comments/1');
  });

  // 3. 重试机制测试
  await runTestCase('Retry mechanism', async () => {
    
    await axion.get('/posts/500', {
      retry: {
        times: 3,
        condition: () => true,
        delay: 500
      },
      validateError: (response) => {
        return true;
      }
    }).catch((error) => {
        throw new Error(`got ${error}`);
    });
  });

  // 5. 请求取消测试
  await runTestCase('Request cancellation', async () => {
    const requestId = 'cancel-test';
    let cancellationVerified = false;

    const cancelPromise = axion.get('/posts/3', { requestId })
      .then(() => {
        throw new Error('Request was not cancelled');
      })
      .catch(e => {
        if (e.name !== 'CanceledError') {
          throw new Error(`Unexpected error type: ${e.name}`);
        }
        cancellationVerified = true;
      })
      .finally(() => {
        if (!cancellationVerified) {
          throw new Error('Cancellation not verified');
        }
      });
    // 添加微小延迟确保请求已开始
    await new Promise(resolve => setTimeout(resolve, 10));
    axion.cancelRequest(requestId);
    await cancelPromise;
  });

  // 6. 防抖测试
  await runTestCase('Debounce requests', async () => {
    const results: any[] = [];
    let lastResponse: any = null;
    
    // 模拟连续调用
    const callApi = async (delay: number) => {
      try {
        const res = await axion.get('/posts/4', { debounce: true
         });
        // 只有成功完成的请求才记录结果
        if (res) {
          results.push(res);
          lastResponse = res;
        }
      } catch (e) {
        // 被防抖取消的请求会抛出 CanceledError，我们忽略它
        if (e.name !== 'CanceledError') {
          throw e;
        }
      }
    };

    // 连续调用3次，每次间隔50ms
    await callApi(0);
    await new Promise(resolve => setTimeout(resolve, 50));
    await callApi(50);
    await new Promise(resolve => setTimeout(resolve, 50));
    await callApi(100);

    // 等待足够时间让防抖生效
    await new Promise(resolve => setTimeout(resolve, 500));

    // 验证结果
    console.log('📨 Received results:', results); 
    // 验证最后响应内容
    if (!lastResponse || lastResponse.id !== 4) {
      throw new Error('Response data verification failed');
    }
  });

  // 7. 请求锁测试
  await runTestCase('Request locking', async () => {
    const [res1, res2] = await Promise.all([
      axion.get('/posts/5', { requestLock: true }),
      axion.get('/posts/5', { requestLock: true })
    ]);
    
    if (res1 !== res2) {
      throw new Error('Request lock failed');
    }else{
      console.log('📨 Lock passed:', res1); 
    }
  });

  // 8. 优先级测试
  await runTestCase('Request priority', async () => {
    const executionOrder: string[] = [];
    
    // 获取当前配置
    const stats = axion.getQueueStats();
    const { maxConcurrent } = stats;
    
    // 通过 Service 类提供的方法更新配置
    axion.updateQueueConfig(0);
    
    // 发起请求，此时请求会进入队列而不会立即执行
    const low = axion.get('/posts/6', { priority: 1 })
      .then(() => executionOrder.push('low'));
    const high = axion.get('/posts/7', { priority: 10 })
      .then(() => executionOrder.push('high'));
    const middle = axion.get('/posts/11')
     .then(() => executionOrder.push('middle'));
    
    // 恢复原配置
    axion.updateQueueConfig(maxConcurrent);
    
    await Promise.all([low, high,middle]);
    
    if (executionOrder[0] !== 'high') {
      throw new Error('High priority request did not execute first');
    } else {
      console.log('📨 Priority passed:', executionOrder);
    }
  });

  // 9. 取消所有请求测试 TODO
  await runTestCase('Cancel all requests', async () => {
    // 先降低并发数，确保请求会进入队列
    const stats = axion.getQueueStats();
    const originalMaxConcurrent = stats.maxConcurrent;
    axion.updateQueueConfig(1);

    const requests = [
      axion.get('/posts/8'),
      axion.get('/posts/9'),
      axion.post('/posts', { title: 'New Post' })
    ];

    // 增加延迟时间，确保请求有足够时间进入系统
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 取消所有请求
    axion.cancelAllRequests();
    
    try {
      const results = await Promise.all(requests.map(p => 
        p.then(() => {
          throw new Error('Request should have been canceled')
        }).catch(e => {
          if (e.name !== 'CanceledError') {
            throw new Error(`Unexpected error type: ${e.name}`);
          }
          return e;
        })
      ));

      // 验证所有请求都被取消
      if (results.length !== 3 || !results.every(r => r.name === 'CanceledError')) {
        throw new Error('Not all requests were canceled');
      }
    } finally {
      // 恢复原始并发数
      axion.updateQueueConfig(originalMaxConcurrent);
    }
  });

  // 系统状态报告
  console.log('\n📊 Final system status:');
  console.log('Cache stats:', axion.getCacheStats());
  console.log('Queue stats:', axion.getQueueStats());
}

// 开发环境执行测试
if (import.meta.env.DEV) {
  console.log('🚀 Starting in development mode...');
  testAxion().then(() => {
    console.log('🏁 All test cases completed');
  });
}

createApp(App).mount('#app')
