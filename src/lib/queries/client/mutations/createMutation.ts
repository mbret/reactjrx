/* eslint-disable @typescript-eslint/naming-convention */
import {
  catchError,
  defer,
  from,
  identity,
  map,
  merge,
  of,
  take,
} from "rxjs"
import { retryOnError } from "../operators"
import { type MutationOptions, type MutationResult } from "./types"

export const createMutation = <Data, MutationArg>({
  mutationFn,
  args,
  ...options
}: {
  args: MutationArg
} & Pick<
  MutationOptions<Data, MutationArg>,
  | "onError"
  | "onSuccess"
  | "mutationFn"
  | "retry"
  | "__queryRunnerHook"
  | "mapOperator"
>) => {
  const mutationFnObservable =
    typeof mutationFn === "function"
      ? defer(() => from(mutationFn(args)))
      : mutationFn

  const queryRunner$ = mutationFnObservable.pipe(
    retryOnError(options),
    take(1),
    map((data) => ({ data, isError: false })),
    catchError((error: unknown) => {
      console.error(error)

      if (options.onError != null) {
        options.onError(error, args)
      }

      return of({ data: error, isError: true })
    })
  )

  const loading$ = of<Partial<MutationResult<Data>>>({
    status: "pending"
  })

  return merge(
    loading$,
    queryRunner$.pipe(
      map(({ data, isError }) => {
        if (!isError) {
          if (options.onSuccess != null) options.onSuccess(data as Data, args)
        }

        return isError
          ? {
              status: "error" as const,
              error: data,
              data: undefined
            }
          : {
              status: "success" as const,
              error: undefined,
              data: data as Data
            }
      })
    )
  ).pipe((options.__queryRunnerHook as typeof identity) ?? identity)
}
