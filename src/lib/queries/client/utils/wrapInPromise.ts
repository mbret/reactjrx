type FuncWithArgs<T extends any[], R> = (...args: T) => R

export async function wrapFnInPromise<T extends any[], R>(
  func: FuncWithArgs<T, R> | FuncWithArgs<T, Promise<R>>,
  ...args: T
): Promise<R> {
  return await new Promise<R>((resolve, reject) => {
    try {
      const result = func(...args)

      if (result instanceof Promise) {
        // If the result is already a Promise, return it directly
        result.then(resolve).catch(reject)
      } else {
        // If the result is not a Promise, wrap it in a Promise and resolve
        resolve(result)
      }
    } catch (error) {
      // Reject with the caught error
      reject(error)
    }
  })
}
