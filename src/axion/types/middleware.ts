import type { AxiosResponse } from 'axios';
import type { RequestConfig } from './service';

export interface MiddlewareContext {
  config: RequestConfig;
  response?: AxiosResponse;
  error?: any;
  startTime: number;
  retryCount?: number;
  fromCache?: boolean;
}

export type MiddlewareNext = () => Promise<any>;

export interface MiddlewareFunction {
  name: string;
  handler: (context: MiddlewareContext, next: MiddlewareNext) => Promise<any>;
  priority?: number; // 中间件执行优先级，数字越小越先执行
}

export interface MiddlewareManager {
  use(middleware: MiddlewareFunction): void;
  remove(name: string): void;
  execute(context: MiddlewareContext): Promise<any>;
  getMiddlewares(): MiddlewareFunction[];
}
