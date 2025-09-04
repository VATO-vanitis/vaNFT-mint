export function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  // Use native if available
  const anyFn = (Promise as any).any;
  if (typeof anyFn === 'function') return anyFn(promises);

  // Fallback using allSettled-style behavior
  return new Promise<T>((resolve, reject) => {
    let rejections = 0;
    const errors: unknown[] = [];
    for (const p of promises) {
      Promise.resolve(p).then(resolve).catch((err) => {
        errors.push(err);
        rejections++;
        if (rejections === promises.length) {
          // AggregateError may not exist in older runtimes
          try {
            // @ts-ignore
            reject(new AggregateError(errors, 'All promises were rejected'));
          } catch {
            reject(new Error('All promises were rejected'));
          }
        }
      });
    }
  });
}
