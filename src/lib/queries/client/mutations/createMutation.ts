/* eslint-disable @typescript-eslint/naming-convention */
import {
  type Subject,
  catchError,
  combineLatest,
  defer,
  from,
  identity,
  map,
  merge,
  of,
  share,
  startWith,
  take,
  takeUntil
} from "rxjs"
import { retryOnError } from "../operators"
import { type MutationOptions, type MutationResult } from "./types"

export const createMutation = <Data, MutationArg>({
  mutationFn,
  args,
  trigger$,
  ...options
}: {
  args: MutationArg
  trigger$: Subject<{
    args: MutationArg
    options: MutationOptions<Data, MutationArg>
  }>
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
    }),
    share()
  )

  const queryIsOver$ = queryRunner$.pipe(
    map(({ data, isError }) => isError || data)
  )

  const isThisCurrentFunctionLastOneCalled = trigger$.pipe(
    take(1),
    map(() => options.mapOperator === "concat"),
    startWith(true),
    takeUntil(queryIsOver$)
  )

  const loading$ = of<Partial<MutationResult<Data>>>({
    status: "pending"
  })

  return merge(
    loading$,
    combineLatest([queryRunner$, isThisCurrentFunctionLastOneCalled]).pipe(
      map(([{ data, isError }, isLastMutationCalled]) => {
        if (!isError) {
          if (options.onSuccess != null) options.onSuccess(data as Data, args)
        }

        if (isLastMutationCalled) {
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
        }

        return {}
      })
    )
  ).pipe((options.__queryRunnerHook as typeof identity) ?? identity)
}
