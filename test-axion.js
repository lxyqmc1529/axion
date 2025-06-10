// 简单的 Node.js 测试文件
import { createAxion } from './dist/axion/index.js';
async function testAxion() {
  try {
    console.log('🧪 Testing Axion...');
    
    // 创建实例
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
    
    console.log('✅ Axion instance created successfully');
    
    // 测试基本功能
    console.log('📊 Cache stats:', axion.getCacheStats());
    console.log('📊 Queue stats:', axion.getQueueStats());
    
    console.log('🎉 Basic tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAxion();
