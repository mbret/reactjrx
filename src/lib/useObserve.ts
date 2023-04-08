import {
  DependencyList,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import { Observable, tap, distinctUntilChanged } from "rxjs";
import { shallowEqual } from "./utils/shallowEqual";

/**
 * Hook that subscribes to an RxJS Observable and
 * synchronizes its latest value with an external store.
 *
 * @example
 * function MyComponent(props) {
 *   const source$ = useMemo(() => ... // Create and memoize an RxJS Observable here
 *
 *   const value = useObserve(source$);
 *
 *   // Render your component here
 *   return <div>The value is: {value}</div>;
 * }
 *
 * @remarks
 * It's important to memoize the Observable using a hook
 * such as `useMemo` or `useCallback` to ensure that the same
 * Observable instance is passed to `useObserve` on every render.
 * Otherwise, the hook will subscribe to a new Observable
 * instance every time the component renders, leading to memory
 * leaks and unexpected behavior.
 */
export function useObserve<T>(
  source$: Observable<T> | (() => Observable<T>),
  { defaultValue }: { defaultValue: T },
  deps: DependencyList = []
) {
  const valueRef = useRef(defaultValue);

  const subscribe = useCallback((next: () => void) => {
    const sourceAsFn = typeof source$ === "function" ? source$ : () => source$;

    const sub = sourceAsFn()
      .pipe(
        distinctUntilChanged(shallowEqual),
        tap((value) => {
          valueRef.current = value;
        })
      )
      .subscribe(next);

    return () => sub.unsubscribe();
  }, deps);

  const getSnapshot = useCallback(() => {
    return valueRef.current;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
