export function promiseAny<T>(iterable: Iterable<Promise<T>>): Promise<T> {
  const errors: any[] = [];
  let pending = 0;
  let resolved = false;

  return new Promise<T>((resolve, reject) => {
    for (const p of iterable) {
      pending++;
      Promise.resolve(p).then(
        (v) => {
          if (!resolved) {
            resolved = true;
            resolve(v);
          }
        },
        (e) => {
          errors.push(e);
          if (--pending === 0 && !resolved) {
            // AggregateError if available, else plain Error
            const Agg: any = (globalThis as any).AggregateError || Error;
            reject(new Agg(errors, "All promises were rejected"));
          }
        }
      );
    }
    if (pending === 0) {
      const Agg: any = (globalThis as any).AggregateError || Error;
      reject(new Agg(errors, "All promises were rejected"));
    }
  });
}
