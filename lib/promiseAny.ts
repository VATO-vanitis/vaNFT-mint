export function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  const anyFn = (Promise as any).any;
  if (typeof anyFn === 'function') return anyFn(promises);
  return new Promise<T>((resolve, reject) => {
    let rejections = 0;
    const errors: unknown[] = [];
    for (const p of promises) {
      Promise.resolve(p).then(resolve).catch((err) => {
        errors.push(err);
        rejections++;
        if (rejections === promises.length) {
          try { /* @ts-ignore */ reject(new AggregateError(errors, 'All promises were rejected')); }
          catch { reject(new Error('All promises were rejected')); }
        }
      });
    }
  });
}
