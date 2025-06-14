export interface RetryConfig {
  times: number;
  delay?: number;
  backoff?: 'linear' | 'exponential';
  condition?: (error: any) => boolean;
  onRetry?: (error: any, retryCount: number) => void;
}
