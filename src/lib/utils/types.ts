// eslint-disable-next-line @typescript-eslint/ban-types
export type WithRequired<T, K extends keyof T> = T & { [_ in K]: {} }

// eslint-disable-next-line @typescript-eslint/ban-types
export type NonFunctionGuard<T> = T extends Function ? never : T

export type NoInfer<T> = [T][T extends any ? 0 : never]

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T
>() => T extends Y ? 1 : 2
  ? true
  : false

export type Expect<T extends true> = T
