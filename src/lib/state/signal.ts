import { BehaviorSubject, Observable, identity } from "rxjs";
import { trackSubscriptions } from "../utils/trackSubscriptions";
import { useObserve } from "../useObserve";

export const signal = <T = undefined>({
  default: defaultValue,
  scoped = false,
  key,
}: {
  default?: T;
  scoped?: boolean;
  key?: string;
}): [
  () => T,
  (stateOrUpdater: T | ((prev: T) => T)) => void,
  Observable<T>
] => {
  const subject = new BehaviorSubject(defaultValue as T);
  const subject$ = subject.asObservable().pipe(
    scoped
      ? trackSubscriptions((numberOfSubscriptions) => {
          if (
            numberOfSubscriptions < 1 &&
            subject.getValue() !== defaultValue
          ) {
            subject.next(defaultValue as T);
          }
        })
      : identity
  );

  const hook = () =>
    useObserve(subject$, { defaultValue: defaultValue as T, key });

  const setValue = <F extends (prev: T) => T>(arg: T | F) => {
    // prevent unnecessary state update if equals
    if (arg === subject.getValue()) return;

    if (typeof arg === "function") {
      const change = (arg as F)(subject.getValue());

      if (change === subject.getValue()) return;

      return subject.next(change);
    }

    return subject.next(arg);
  };

  return [hook, setValue, subject$];
};
