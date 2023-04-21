import { DependencyList, useEffect } from "react"
import {
  Observable,
  distinctUntilChanged,
  catchError,
  EMPTY,
  switchMap,
  withLatestFrom,
  defer,
  map,
  finalize,
  tap
} from "rxjs"
import { shallowEqual } from "./utils/shallowEqual"
import { useBehaviorSubject } from "./useBehaviorSubject"
import { arrayEqual } from "./utils/arrayEqual"

export function useSubscribe<T>(source: Observable<T>): void

export function useSubscribe<T>(
  source$: () => Observable<T>,
  deps: DependencyList
): void

export function useSubscribe<T>(
  source: Observable<T> | (() => Observable<T>),
  deps: DependencyList = []
) {
  const params$ = useBehaviorSubject({ deps, source })

  useEffect(() => {
    params$.current.next({ deps, source })
  }, [params$, ...deps, source])

  useEffect(() => {
    const source$ = params$.current.pipe(map((params) => params.source))

    // @todo trigger on source obserable change
    const deps$ = params$.current.pipe(
      map(({ deps }) => deps as any[]),
      distinctUntilChanged(arrayEqual),
      tap(() => {
        console.log("deps$ change", deps)
      }),
      finalize(() => {
        console.log("deps$ finalized")
      })
    )

    const sub = deps$
      .pipe(
        withLatestFrom(source$),
        switchMap(([, source]) =>
          defer(() => (typeof source === "function" ? source() : source)).pipe(
            distinctUntilChanged(shallowEqual),
            catchError((error) => {
              console.error(error)

              return EMPTY
            })
          )
        )
        // takeUntil(deps$)
      )
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [params$])
}
