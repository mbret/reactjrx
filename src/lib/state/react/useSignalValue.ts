import { type Observable, distinctUntilChanged, map } from "rxjs";
import { useObserve } from "../../binding/useObserve";
import type { ReadOnlySignal, Signal } from "../signal";

export function useSignalValue<DefaultValue, Value, Key, SelectValue>(
  signal: Signal<DefaultValue, Value, Key>,
  selector: (value: DefaultValue) => SelectValue,
): SelectValue;
export function useSignalValue<DefaultValue, Value, Key>(
  signal: Signal<DefaultValue, Value, Key>,
): DefaultValue;
// read only
export function useSignalValue<Value>(signal: ReadOnlySignal<Value>): Value;
// read only select
export function useSignalValue<Value, SelectValue>(
  signal: ReadOnlySignal<Value>,
  selector: (value: Value) => SelectValue,
): SelectValue;
export function useSignalValue<DefaultValue, Value, Key, SelectedValue>(
  signal: Signal<DefaultValue, Value, Key> | ReadOnlySignal<Value>,
  selector?: (
    value: DefaultValue | Value,
  ) => SelectedValue | DefaultValue | Value,
) {
  const defaultSelector = () => signal.getValue();
  const selectorOrDefault = selector ?? defaultSelector;

  return useObserve(
    () => {
      const observed$ = (signal.subject as Observable<Value>).pipe(
        map((value) => {
          const selectedValue = selectorOrDefault(value);

          return selectedValue;
        }),
        distinctUntilChanged(),
      );

      return observed$;
    },
    {
      defaultValue: selectorOrDefault(signal.getValue()),
    },
    [],
  );
}
