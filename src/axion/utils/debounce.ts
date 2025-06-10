export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: number | null = null;
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null;
  let rejectPromise: ((reason: any) => void) | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      // 清除之前的定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // 如果有之前的 Promise，先拒绝它
      if (rejectPromise) {
        rejectPromise(new Error('Debounced'));
      }
      
      resolvePromise = resolve;
      rejectPromise = reject;
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          if (resolvePromise) {
            resolvePromise(result);
          }
        } catch (error) {
          if (rejectPromise) {
            rejectPromise(error);
          }
        } finally {
          timeoutId = null;
          resolvePromise = null;
          rejectPromise = null;
        }
      }, delay);
    });
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let timeoutId: number | null = null;
  
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - (now - lastCall));
    }
  };
}
