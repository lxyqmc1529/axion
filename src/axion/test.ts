import { createAxion } from './index';

// 简单的测试函数
async function runTests() {
  console.log('🧪 Starting Axion tests...');
  
  // 创建测试实例
  const axion = createAxion({
    baseURL: 'https://jsonplaceholder.typicode.com',
    defaultCache: {
      enabled: true,
      ttl: 30000, // 30秒
    },
    defaultRetry: {
      times: 2,
      delay: 1000,
    },
  });
  
  try {
    // 测试 1: 基本 GET 请求
    console.log('📡 Test 1: Basic GET request');
    const posts = await axion.get('/posts?_limit=3');
    console.log('✅ GET request successful, received', posts.length, 'posts');
    
    // 测试 2: 缓存功能
    console.log('📡 Test 2: Cache functionality');
    const start = Date.now();
    await axion.get('/posts/1', { cache: true });
    const firstRequestTime = Date.now() - start;
    
    const start2 = Date.now();
    await axion.get('/posts/1', { cache: true });
    const secondRequestTime = Date.now() - start2;
    
    console.log(`✅ Cache test: First request: ${firstRequestTime}ms, Second request: ${secondRequestTime}ms`);
    
    // 测试 3: POST 请求
    console.log('📡 Test 3: POST request');
    const newPost = await axion.post('/posts', {
      title: 'Test Post',
      body: 'This is a test post',
      userId: 1,
    });
    console.log('✅ POST request successful, created post with ID:', newPost.id);
    
    // 测试 4: 错误处理
    console.log('📡 Test 4: Error handling');
    try {
      await axion.get('/posts/999999');
    } catch (error: any) {
      console.log('✅ Error handling works:', error.message);
    }
    
    // 测试 5: 中间件
    console.log('📡 Test 5: Middleware');
    axion.use({
      name: 'test-middleware',
      priority: 1,
      handler: async (context, next) => {
        console.log('🔧 Middleware: Request started for', context.config.url);
        const result = await next();
        console.log('🔧 Middleware: Request completed');
        return result;
      },
    });
    
    await axion.get('/posts/1');
    
    // 测试 6: 缓存统计
    console.log('📡 Test 6: Cache stats');
    const cacheStats = axion.getCacheStats();
    console.log('✅ Cache stats:', cacheStats);
    
    // 测试 7: 队列统计
    console.log('📡 Test 7: Queue stats');
    const queueStats = axion.getQueueStats();
    console.log('✅ Queue stats:', queueStats);
    
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// 导出测试函数
export { runTests };
