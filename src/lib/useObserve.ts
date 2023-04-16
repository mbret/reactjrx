import {
  DependencyList,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  Observable,
  tap,
  distinctUntilChanged,
  catchError,
  EMPTY,
  BehaviorSubject,
  switchMap,
} from "rxjs";
import { useConstant } from "./utils/useConstant";
import { primitiveEqual } from "./utils/primitiveEqual";

type Option<R = undefined> = { defaultValue: R; key?: string };

export function useObserve<T>(source: Observable<T>): T | undefined;

export function useObserve<T>(
  source: () => Observable<T>,
  deps: DependencyList
): T | undefined;

export function useObserve<T, R = undefined>(
  source: Observable<T>,
  options: Option<R>
): T | R;

export function useObserve<T, R = undefined>(
  source: () => Observable<T>,
  options: Option<R>,
  deps: DependencyList
): T | R;

export function useObserve<T, R>(
  source$: Observable<T> | (() => Observable<T>),
  unsafeOptions?: Option<R> | DependencyList,
  unsafeDeps?: DependencyList
): T | R {
  const options =
    unsafeOptions && !Array.isArray(unsafeOptions)
      ? (unsafeOptions as Option<R>)
      : { defaultValue: undefined };
  const deps =
    !unsafeDeps && Array.isArray(unsafeOptions)
      ? unsafeOptions
      : unsafeDeps ?? [];
  const valueRef = useRef({ data: options.defaultValue, error: undefined });
  const params$ = useConstant(() => new BehaviorSubject({ deps }));
  const isSourceFn = typeof source$ === "function";
  const makeObservable = useCallback(
    isSourceFn ? source$ : () => source$,
    isSourceFn ? deps : [source$]
  );

  // useEffect(() => {
  //   params$.current.next({ deps });
  // }, deps);

  // useEffect(
  //   () => () => {
  //     params$.current.complete();
  //   },
  //   []
  // );

  const subscribe = useCallback((next: () => void) => {
    const sub = params$.current
      .pipe(
        switchMap(() =>
          makeObservable().pipe(
            /**
             * @important
             * We only check primitives because underlying subscription might
             * be using objects and keeping same reference but pushing new
             * properties values
             */
            distinctUntilChanged(primitiveEqual),
            tap((value) => {
              valueRef.current = { data: value, error: undefined };
            }),
            catchError((error) => {
              console.error(error);

              valueRef.current = { ...valueRef.current, error };

              return EMPTY;
            })
          )
        )
      )
      .subscribe(next);

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return valueRef.current;
  }, []);

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot).data;

  return result as T | R;
}
