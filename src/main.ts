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
        const res = await axion.get('/posts/4', { debounce: true });
        results.push(res);
        lastResponse = res;
      } catch (e) {
        if (e.name !== 'CanceledError') {
          throw e;
        }
      }
    };

    // 连续调用3次，每次间隔50ms（应小于防抖默认时间）
    setTimeout(() => callApi(0), 0);
    setTimeout(() => callApi(50), 50);
    setTimeout(() => callApi(100), 100);

    // 等待足够时间让防抖生效
    await new Promise(resolve => setTimeout(resolve, 500));

    // 验证结果
    if (results.length !== 1) {
      throw new Error(`Expected 1 successful request, got ${results.length}`);
    }
    
    // 验证最后响应内容
    if (!lastResponse || !lastResponse.id === 4) {
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
    }
  });

  // 8. 优先级测试
  await runTestCase('Request priority', async () => {
    const executionOrder: string[] = [];
    
    const low = axion.get('/posts/6', { priority: 1 })
      .then(() => executionOrder.push('low'));
    const high = axion.get('/posts/7', { priority: 10 })
      .then(() => executionOrder.push('high'));

    await Promise.all([low, high]);
    
    if (executionOrder[0] !== 'high') {
      throw new Error('High priority request did not execute first');
    }
  });

  // 9. 取消所有请求测试
  await runTestCase('Cancel all requests', async () => {
    const requests = [
      axion.get('/posts/8'),
      axion.get('/posts/9'),
      axion.post('/posts', { title: 'New Post' })
    ];

    // Cancel all requests after short delay
    setTimeout(() => axion.cancelAllRequests(), 10);
    
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

    // Verify all requests were canceled
    if (results.length !== 3 || !results.every(r => r.name === 'CanceledError')) {
      throw new Error('Not all requests were canceled');
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
