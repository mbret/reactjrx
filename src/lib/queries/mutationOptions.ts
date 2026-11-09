import type { Observable } from "rxjs"

/**
 * Resolves the public `mutationFn` option — an Observable or a function
 * returning one — to its source Observable for the given variables.
 */
export function resolveMutationFnSource<TData, TVariables>(
  mutationFn:
    | ((variables: TVariables) => Observable<TData>)
    | Observable<TData>,
  variables: TVariables,
) {
  return typeof mutationFn === "function" ? mutationFn(variables) : mutationFn
}
