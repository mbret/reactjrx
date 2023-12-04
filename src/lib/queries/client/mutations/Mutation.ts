/* eslint-disable @typescript-eslint/naming-convention */
import {
  type Observable,
  catchError,
  defer,
  from,
  identity,
  map,
  merge,
  of,
  share,
  take,
  tap,
  ReplaySubject
} from "rxjs"
import { retryOnError } from "../operators"
import { type MutationState, type MutationOptions } from "./types"
import { getDefaultMutationState } from "./defaultMutationState"
import { mergeResults } from "./operators"

export class Mutation<Data> {
  stateSubject = new ReplaySubject<MutationState<Data>>(1)

  /**
   * @important
   * convenience over usage of stateSubject for sync access
   */
  state: MutationState<Data> = getDefaultMutationState()

  options: MutationOptions<Data, any>

  mutation$: Observable<MutationState<Data>>

  constructor({
    args,
    ...options
  }: {
    args: any
  } & MutationOptions<Data, any>) {
    this.options = options
    const mutationFn = options.mutationFn

    this.state.variables = args
    this.stateSubject.next(this.state)

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

    const initState$ = of({
      ...this.state,
      status: "pending",
      submittedAt: new Date().getTime()
    } satisfies MutationState<Data>)

    this.mutation$ = merge(
      initState$,
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
                error: null,
                data: data as Data
              }
        })
      )
    ).pipe(
      mergeResults,
      tap((value) => {
        this.state = { ...this.state, ...value }
        this.stateSubject.next(this.state)
      }),
      (options.__queryRunnerHook as typeof identity) ?? identity,
      share()
    )
  }
}
