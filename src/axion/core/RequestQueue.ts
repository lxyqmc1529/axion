import { generateRequestId } from '../utils';
import type { RequestTask, RequestConfig } from '../types/service';

class CanceledError extends Error {
  constructor(message: string = 'Request cancelled') {
    super(message);
    this.name = 'CanceledError';
  }
}

export class RequestQueue {
  private queue: RequestTask[] = [];
  private running: Map<string, RequestTask> = new Map();
  private maxConcurrent: number;
  private maxQueueSize: number;

  constructor(maxConcurrent: number = 6, maxQueueSize: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
  }

  async add(config: RequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Request queue is full'));
        return;
      }

      const controller = new AbortController();
      const task: RequestTask = {
        id: config.requestId || generateRequestId(config),
        config: {
          ...config,
          signal: controller.signal,
        },
        priority: config.priority || 5,
        timestamp: Date.now(),
        resolve,
        reject,
        controller,
      };

      this.enqueue(task);
      this.processQueue();
    });
  }

  cancelAll(): void {
    // 取消队列中的所有请求
    this.queue.forEach(task => {
      task.controller.abort();
      task.reject(new CanceledError());
    });
    this.queue = [];

    // 取消正在执行的所有请求
    this.running.forEach(task => {
      task.controller.abort();
      task.reject(new CanceledError());
    });
    this.running.clear();
  }

  cancel(requestId: string): boolean {
    // 取消队列中的请求
    const queueIndex = this.queue.findIndex(task => task.id === requestId);
    if (queueIndex !== -1) {
      const task = this.queue[queueIndex];
      this.queue.splice(queueIndex, 1);
      task.controller.abort();
      task.reject(new CanceledError());
      return true;
    }

    // 取消正在执行的请求
    const runningTask = this.running.get(requestId);
    if (runningTask) {
      runningTask.controller.abort();
      runningTask.reject(new CanceledError());
      this.running.delete(requestId);
      this.processQueue(); // 处理下一个请求
      return true;
    }

    return false;
  }

  getStats() {
    return {
      pending: this.queue.length,
      running: this.running.size,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
    };
  }

  updateConfig(maxConcurrent?: number, maxQueueSize?: number): void {
    if (maxConcurrent !== undefined) {
      this.maxConcurrent = maxConcurrent;
    }
    if (maxQueueSize !== undefined) {
      this.maxQueueSize = maxQueueSize;
    }
    this.processQueue();
  }

  private enqueue(task: RequestTask): void {
    // 按优先级插入队列（优先级高的在前面）
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, task);
  }

  private async processQueue(): Promise<void> {
    if (this.maxConcurrent <= 0) return;
    
    // 添加延迟以确保所有请求都有机会进入队列
    await new Promise(resolve => setTimeout(resolve, 0));
    
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      // 每次都从队列中选择优先级最高的请求
      let highestPriorityIndex = 0;
      for (let i = 1; i < this.queue.length; i++) {
        if (this.queue[i].priority > this.queue[highestPriorityIndex].priority) {
          highestPriorityIndex = i;
        }
      }
      
      const task = this.queue.splice(highestPriorityIndex, 1)[0];
      this.running.set(task.id, task);

      this.executeTask(task).finally(() => {
        this.running.delete(task.id);
        this.processQueue(); // 继续处理队列
      });
    }
  }

  private async executeTask(task: RequestTask): Promise<void> {
    try {
      // 这里需要实际的请求执行逻辑
      // 在 Service 类中会注入实际的执行函数
      const result = await this.executeRequest(task.config);
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    }
  }

  private executeRequest: (config: RequestConfig) => Promise<any> = async () => {
    throw new Error('Request executor not set');
  };

  setRequestExecutor(executor: (config: RequestConfig) => Promise<any>): void {
    this.executeRequest = executor;
  }
}
