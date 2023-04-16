import {
  DependencyList,
  useCallback,
  useEffect,
} from "react";
import {
  Observable,
  distinctUntilChanged,
  catchError,
  EMPTY,
  BehaviorSubject,
  switchMap,
} from "rxjs";
import { shallowEqual } from "./utils/shallowEqual";
import { useConstant } from "./utils/useConstant";

export function useSubscribe<T>(
  source$: Observable<T> | (() => Observable<T>),
  deps: DependencyList = []
) {
  const params$ = useConstant(() => new BehaviorSubject({ deps }));
  const isSourceFn = typeof source$ === "function";
  const makeObservable = useCallback(
    isSourceFn ? source$ : () => source$,
    isSourceFn ? deps : [source$]
  );

  useEffect(() => {
    params$.current.next({ deps });
  }, deps);

  useEffect(
    () => () => {
      params$.current.complete();
    },
    []
  );

  useEffect(() => {
    const sub = params$.current
      .pipe(
        switchMap(() =>
          makeObservable().pipe(
            distinctUntilChanged(shallowEqual),
            catchError((error) => {
              console.error(error);

              return EMPTY;
            })
          )
        )
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);
}
