import { useCallback, useEffect, useRef } from "react";
import { useLiveRef } from "../utils/useLiveRef";
import {
  BehaviorSubject,
  Subject,
  catchError,
  delay,
  from,
  map,
  of,
  switchMap,
  tap,
} from "rxjs";
import { useConstant } from "../utils/useConstant";
import { useObserve } from "../useObserve";

export const useMutation = <R>(query: () => Promise<R>) => {
  const queryRef = useLiveRef(query);
  const triggerSubject = useRef(new Subject()).current;
  const data$ = useConstant(
    () =>
      new BehaviorSubject<{
        data: R | undefined;
        isLoading: boolean;
        error: unknown;
      }>({
        data: undefined,
        error: undefined,
        isLoading: false,
      })
  );

  useEffect(() => {
    const sub = triggerSubject
      .pipe(
        tap(() => {
          console.log("trigger");
        }),
        tap(() => {
          data$.next({
            ...data$.getValue(),
            error: undefined,
            isLoading: true,
          });
        }),
        delay(2000),
        switchMap(() =>
          from(queryRef.current()).pipe(
            map((response) => [response] as const),
            catchError((error: unknown) => {
              return of([undefined, error] as const);
            })
          )
        ),
        tap(([response, error]) => {
          data$.next({
            ...data$.getValue(),
            isLoading: false,
            error,
            data: response,
          });
        }),
        tap(() => {
          console.log("settled");
        })
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [triggerSubject, data$]);

  const result = useObserve(data$, {
    defaultValue: data$.getValue(),
  });

  const mutate = useCallback(() => {
    triggerSubject.next(undefined);
  }, [triggerSubject]);

  return { ...result, mutate };
};
