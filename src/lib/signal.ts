import { BehaviorSubject } from "rxjs";
import { useObserve } from "./useObserve";

export const signal = <T>({
  default: defaultValue,
}: {
  default: T;
}): [() => T, (state: T | ((prev: T) => T)) => void] => {
  const subject = new BehaviorSubject(defaultValue);

  const hook = () => useObserve(subject.asObservable(), { defaultValue }, []);

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

  return [hook, setValue];
};
