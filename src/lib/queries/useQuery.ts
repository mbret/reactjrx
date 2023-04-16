import { useCallback, useEffect, useRef } from "react";
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  of,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs";
import { arrayEqual } from "../utils/arrayEqual";
import { shallowEqual } from "../utils/shallowEqual";
import { useObserve } from "../useObserve";
import { querx } from "./querx";
import { QuerxOptions } from "./types";
import { useLiveRef } from "../utils/useLiveRef";
import { useConstant } from "../utils/useConstant";

export function useQuery<T>(
  key: any[],
  fn: () => Promise<T>,
  options: QuerxOptions = {}
): {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const queryRef = useLiveRef(fn);
  const params$ = useRef(new BehaviorSubject({ key, options }));
  const refetchSubject$ = useConstant(() => new Subject());
  const data$ = useConstant(
    () =>
      new BehaviorSubject<{
        data: T | undefined;
        isLoading: boolean;
        error: unknown;
      }>({
        data: undefined,
        error: undefined,
        isLoading: false,
      })
  );

  useEffect(() => {
    params$.current.next({
      key,
      options,
    });
  }, [key, options]);

  useEffect(
    () => () => {
      data$.current.complete();
      refetchSubject$.current.complete();
      params$.current.complete();
    },
    []
  );

  useEffect(() => {
    const options$ = params$.current.pipe(
      map(({ options }) => options),
      distinctUntilChanged(shallowEqual)
    );

    const key$ = params$.current.pipe(
      map(({ key }) => key),
      distinctUntilChanged(arrayEqual)
    );

    const enabledOption$ = options$.pipe(
      map(({ enabled = true }) => enabled),
      distinctUntilChanged()
    );

    const executeFn$ = combineLatest([
      key$,
      enabledOption$,
      refetchSubject$.current.pipe(startWith(undefined)),
    ]).pipe(
      tap(([, enabled]) => {
        // we know that any ongoing promise will be cancelled
        // so we can safely stop loading. We don't do it in finalize
        // because it would conflict with concurrency
        if (!enabled) {
          data$.current.next({
            ...data$.current.getValue(),
            isLoading: false,
          });
        }
      }),
      filter(([, enabled]) => enabled),
      map(([fn]) => fn)
    );

    const disabled$ = enabledOption$.pipe(filter((v) => !v));

    const sub = executeFn$
      .pipe(
        withLatestFrom(options$),
        tap(() => {
          data$.current.next({
            ...data$.current.getValue(),
            error: undefined,
            isLoading: true,
          });
        }),
        switchMap(([, options]) =>
          from(defer(() => queryRef.current())).pipe(
            querx(options),
            map((response) => [response] as const),
            catchError((error) => {
              return of([undefined, error] as const);
            }),
            takeUntil(disabled$)
          )
        ),
        tap(([response, error]) => {
          data$.current.next({
            ...data$.current.getValue(),
            isLoading: false,
            error,
            data: response,
          });
        })
      )
      .subscribe({
        next: () => {},
        complete: () => {
          console.error("useQuerx has completed");
        },
        error: console.error,
      });

    return () => sub.unsubscribe();
  }, [refetchSubject$, data$]);

  const result = useObserve(data$.current, {
    defaultValue: data$.current.getValue(),
  });

  const refetch = useCallback(
    () => refetchSubject$.current.next(undefined),
    [refetchSubject$]
  );

  return { ...result, refetch };
}
