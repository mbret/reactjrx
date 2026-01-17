export type WithRequired<TTarget, TKey extends keyof TTarget> = TTarget & {
  // biome-ignore lint/complexity/noBannedTypes: TODO
  [_ in TKey]: {}
}

// biome-ignore lint/complexity/noBannedTypes: TODO
export type NonFunctionGuard<T> = T extends Function ? never : T

// @todo migrate to 5.4 which is part of the API
// biome-ignore lint/suspicious/noExplicitAny: TODO
export type NoInfer<T> = [T][T extends any ? 0 : never]

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false

export type Expect<T extends true> = T

export type OmitKeyof<
  TObject,
  TKey extends TStrictly extends "safely"
    ? keyof TObject | (string & Record<never, never>)
    : keyof TObject,
  TStrictly extends "strictly" | "safely" = "strictly",
> = Omit<TObject, TKey>
