import { useCallback, useEffect, useRef } from "react";
import { useLiveRef } from "../utils/useLiveRef";
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  defer,
  first,
  from,
  map,
  of,
  switchMap,
  tap,
} from "rxjs";
import { useConstant } from "../utils/useConstant";
import { useObserve } from "../useObserve";
import { querx } from "./querx";
import { QuerxOptions } from "./types";

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
 *
 * @important
 * If you return an observable, the stream will be unsubscribed after receiving
 * the first value. This hook is not meant to be running long running effects.
 */
export const useMutation = <A = unknown, R = unknown>(
  query: (args: A) => Promise<R> | Observable<R>,
  options: QuerxOptions = {}
) => {
  const queryRef = useLiveRef(query);
  const triggerSubject = useRef(new Subject<A>());
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

  useEffect(
    () => () => {
      data$.current.complete();
      triggerSubject.current.complete();
    },
    []
  );

  useEffect(() => {
    const sub = triggerSubject.current
      .pipe(
        tap(() => {
          console.log("trigger", optionsRef.current);
        }),
        tap(() => {
          data$.current.next({
            ...data$.current.getValue(),
            error: undefined,
            isLoading: true,
          });
        }),
        switchMap((args) =>
          from(defer(() => queryRef.current(args))).pipe(
            querx(optionsRef.current),
            map((response) => [response] as const),
            first(),
            catchError((error: unknown) => {
              optionsRef.current.onError && optionsRef.current.onError(error);

              return of([undefined, error] as const);
            })
          )
        ),
        tap(([response, error]) => {
          if (response) {
            optionsRef.current.onSuccess && optionsRef.current.onSuccess();
          }

          data$.current.next({
            ...data$.current.getValue(),
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

  const result = useObserve(data$.current, {
    defaultValue: data$.current.getValue(),
  });

  const mutate = useCallback(
    (args: A) => {
      triggerSubject.current.next(args);
    },
    [triggerSubject]
  );

  return { ...result, mutate };
};
