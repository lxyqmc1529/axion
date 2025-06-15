import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RequestQueue } from '../RequestQueue'

describe('RequestQueue', () => {
  let queue: RequestQueue

  beforeEach(() => {
    queue = new RequestQueue()
  })

  describe('构造函数', () => {
    it('应该使用默认值正确初始化', () => {
      const stats = queue.getStats()
      expect(stats.maxConcurrent).toBe(6)
      expect(stats.maxQueueSize).toBe(100)
      expect(stats.pending).toBe(0)
      expect(stats.running).toBe(0)
    })

    it('应该使用自定义值正确初始化', () => {
      const customQueue = new RequestQueue(3, 50)
      const stats = customQueue.getStats()
      expect(stats.maxConcurrent).toBe(3)
      expect(stats.maxQueueSize).toBe(50)
    })
  })

  describe('add方法', () => {
    it('应该成功添加请求到队列', async () => {
      const mockExecutor = vi.fn().mockResolvedValue('success')
      queue.setRequestExecutor(mockExecutor)

      const promise = queue.add({
        url: 'test-url',
        method: 'GET'
      })

      expect(queue.getStats().pending).toBe(1) // 由于processQueue添加的确保请求加入队列的延迟机制，延迟期间立即调用getStats，此时请求依然在队列中
      expect(queue.getStats().running).toBe(0)

      await promise
      expect(mockExecutor).toHaveBeenCalled()
    })

    it('当队列已满时应该拒绝新的请求', async () => {
      const customQueue = new RequestQueue(1, 1)
      customQueue.setRequestExecutor(() => new Promise(() => {})) // 永不完成的请求

      // 添加第一个请求（会被立即执行）
      const firstRequest = customQueue.add({
        url: 'test-url-1',
        method: 'GET'
      })

      // 添加第二个请求（应该被拒绝，因为队列大小为1且已有一个正在执行的请求）
      await expect(customQueue.add({
        url: 'test-url-2',
        method: 'GET'
      })).rejects.toThrow('Request queue is full')
    })
  })

  describe('cancel方法', () => {
    it('应该成功取消队列中的请求', async () => {
      const mockExecutor = vi.fn()
      queue.setRequestExecutor(mockExecutor)

      const promise = queue.add({
        requestId: 'test-id',
        url: 'test-url',
        method: 'GET'
      })

      const canceled = queue.cancel('test-id')
      expect(canceled).toBe(true)

      await expect(promise).rejects.toThrow('Request cancelled')
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    it('当请求ID不存在时应该返回false', () => {
      const canceled = queue.cancel('non-existent-id')
      expect(canceled).toBe(false)
    })
  })

  describe('cancelAll方法', () => {
    it('应该取消所有请求', async () => {
      const mockExecutor = vi.fn()
      queue.setRequestExecutor(mockExecutor)

      const promises = [
        queue.add({ url: 'test-url-1', method: 'GET' }),
        queue.add({ url: 'test-url-2', method: 'GET' }),
        queue.add({ url: 'test-url-3', method: 'GET' })
      ]

      queue.cancelAll()

      await Promise.all(promises.map(p => expect(p).rejects.toThrow('Request cancelled')))
      expect(mockExecutor).not.toHaveBeenCalled()
      expect(queue.getStats().pending).toBe(0)
      expect(queue.getStats().running).toBe(0)
    })
  })

  describe('updateConfig方法', () => {
    it('应该正确更新配置', () => {
      queue.updateConfig({ maxConcurrent: 10, maxQueueSize: 200 })
      const stats = queue.getStats()
      expect(stats.maxConcurrent).toBe(10)
      expect(stats.maxQueueSize).toBe(200)
    })

    it('应该只更新提供的配置项', () => {
      const originalStats = queue.getStats()
      queue.updateConfig({ maxQueueSize: 200 })
      const newStats = queue.getStats()
      
      expect(newStats.maxConcurrent).toBe(originalStats.maxConcurrent)
      expect(newStats.maxQueueSize).toBe(200)
    })
  })
})