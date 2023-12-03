/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
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
  tap
} from "rxjs"
import { retryOnError } from "../operators"
import {
  type MutationState,
  type MutationOptions,
  type MutationResult
} from "./types"
import { getDefaultMutationState } from "./defaultMutationState"
import { mergeResults } from "./operators"

export class Mutation<Data> {
  stateSubject = new BehaviorSubject<MutationState<Data>>(
    getDefaultMutationState()
  )

  options: MutationOptions<Data, any>

  mutation$: Observable<MutationResult<Data>>

  constructor({
    args,
    ...options
  }: {
    args: any
  } & MutationOptions<Data, any>) {
    this.options = options
    const mutationFn = options.mutationFn

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

    this.mutation$ = merge(
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
                error: null,
                data: data as Data
              }
        })
      )
    ).pipe(
      mergeResults,
      tap((value) => {
        this.stateSubject.next({ ...this.stateSubject.getValue(), ...value })
      }),
      (options.__queryRunnerHook as typeof identity) ?? identity,
      share()
    )
  }
}
