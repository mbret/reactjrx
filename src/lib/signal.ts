import { BehaviorSubject, identity } from "rxjs";
import { useObserve } from "./useObserve";
import { trackSubscriptions } from "./utils/trackSubscriptions";

export const signal = <T>({
  default: defaultValue,
  scoped = false,
  key,
}: {
  default: T;
  scoped?: boolean;
  key?: string;
}) => {
  const subject = new BehaviorSubject(defaultValue);
  const subject$ = subject.asObservable().pipe(
    scoped
      ? trackSubscriptions((numberOfSubscriptions) => {
          if (
            numberOfSubscriptions < 1 &&
            subject.getValue() !== defaultValue
          ) {
            subject.next(defaultValue);
          }
        })
      : identity
  );

  const hook = () => useObserve(subject$, { defaultValue, key });

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

  return [hook, setValue, subject$] as const;
};
