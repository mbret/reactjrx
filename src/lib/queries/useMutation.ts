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

/**
 * @important
 * Your mutation function is cancelled whenever you call a new mutate or
 * when the component is unmounted. Same behavior will happens with your
 * callback functions regarding unmounting. None of them will be called.
 *
 * If you provide an observable as a return it will be automatically cancelled
 * as well during unmont or if called again. If you provide anything else you
 * are in charge of controlling the flow.
 *
 * If you need to execute mutation independently of the component lifecycle or
 * execute functions in parallel you should not use this hook.
 */
export const useMutation = <R>(
  query: () => Promise<R>,
  options: { onError?: (error: unknown) => void; onSuccess?: () => void } = {}
) => {
  const queryRef = useLiveRef(query);
  const triggerSubject = useRef(new Subject()).current;
  const optionsRef = useLiveRef(options);
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
              optionsRef.current.onError && optionsRef.current.onError(error);

              return of([undefined, error] as const);
            })
          )
        ),
        tap(([response, error]) => {
          optionsRef.current.onSuccess && optionsRef.current.onSuccess();

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
