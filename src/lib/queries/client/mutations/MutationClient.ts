import {
  type Observable,
  Subject,
  catchError,
  combineLatest,
  concatMap,
  defer,
  finalize,
  first,
  from,
  map,
  merge,
  mergeMap,
  of,
  startWith,
  switchMap,
  take,
  takeUntil,
  withLatestFrom,
  tap,
  share
} from "rxjs"
import { serializeKey } from "../keys/serializeKey"
import { Logger } from "../../../logger"
import { retryOnError } from "../operators"
import { type MutationResult, type MutationOptions } from "./types"
import { mergeResults } from "./operators"
import { trigger } from "../../../binding/trigger"

export class MutationClient {
  createMutation = <T, MutationArg>(
    options$: Observable<MutationOptions<T, MutationArg>>
  ) => {
    const trigger$ = new Subject<MutationArg>()
    const reset$ = new Subject<void>()
    let closed = false

    /**
     * Mutation can be destroyed in two ways
     * - caller unsubscribe to the mutation
     * - caller call destroy directly
     */
    const destroy = () => {
      if (closed) throw new Error("Trying to close an already closed mutation")

      trigger$.complete()
      reset$.complete()
      closed = true
    }

    const initOptions = options$.pipe(
      tap(({ mutationKey }) => {
        const serializedKey = serializeKey(mutationKey)

        Logger.log("query$)", serializedKey)
      }),
      take(1)
    )

    const mutation$ = initOptions.pipe(
      mergeMap((options) => {
        const { mapOperator } = options

        const switchOperator =
          mapOperator === "concat"
            ? concatMap
            : mapOperator === "switch"
              ? switchMap
              : mergeMap

        return trigger$.pipe(
          withLatestFrom(options$),
          switchOperator(([mutationArg, { mutationFn }]) => {
            const queryRunner$ = defer(() =>
              from(mutationFn(mutationArg))
            ).pipe(
              retryOnError(options),
              first(),
              map((data) => ({ data, isError: false })),
              catchError((error: unknown) => {
                console.error(error)

                if (options.onError != null) {
                  options.onError(error, mutationArg)
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
              map(() => mapOperator === "concat"),
              startWith(true),
              takeUntil(queryIsOver$)
            )

            const loading$ = of<Partial<MutationResult<T>>>({
              status: "loading"
            })

            return merge(
              loading$,
              combineLatest([
                queryRunner$,
                isThisCurrentFunctionLastOneCalled
              ]).pipe(
                map(([{ data, isError }, isLastMutationCalled]) => {
                  if (!isError) {
                    if (options.onSuccess != null)
                      options.onSuccess(data as T, mutationArg)
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
                          data: data as T
                        }
                  }

                  return {}
                }),
                takeUntil(reset$),
                finalize(() => {
                  console.log("finalize query")
                })
              )
            )
          }),
          mergeResults,
          //   options.triggerHook ?? identity,
          finalize(() => {
            console.log("finalize trigger")
          })
        )
      }),
      finalize(() => {
        console.log("finalize mutation")
        destroy()
      })
    )

    return {
      mutation$,
      trigger$,
      reset$,
      destroy
    }
  }
}
