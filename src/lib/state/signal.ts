import { BehaviorSubject, first, skip } from "rxjs";
import type { Observable } from "rxjs";
import { SIGNAL_RESET } from "./constants";

type setValue<S> = (
  stateOrUpdater: typeof SIGNAL_RESET | S | ((prev: S) => S),
) => void;

type Getter<Value> = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  get: <GetSignal extends Signal<any, any, any>>(
    signal: GetSignal,
  ) => ReturnType<GetSignal["getValue"]>,
) => Value;

export type Config<
  DefaultValue = undefined,
  Key = undefined,
> = Key extends undefined
  ? {
      default: DefaultValue;
    }
  : {
      default: DefaultValue;
      key: Key;
    };

interface ReadOnlySignalConfig<Value> {
  get: Getter<Value>;
}

export interface ReadOnlySignal<Value> {
  getValue: () => Value;
  config: ReadOnlySignalConfig<Value>;
  subject: Observable<Value>;
}

export interface Signal<
  DefaultValue = undefined,
  Value = undefined,
  Key = undefined,
> {
  setValue: setValue<DefaultValue>;
  getValue: () => Value;
  config: Config<DefaultValue, Key>;
  subject: Observable<DefaultValue>;
}

export function signal<T = undefined, V = T>(
  config?: Omit<Partial<Config<T, string | undefined>>, "key" | "get">,
): Signal<T, V, undefined>;

export function signal<T = undefined, V = T>(
  config: Omit<Partial<Config<T, string | undefined>>, "get"> & {
    key: string;
  },
): Signal<T, V, string>;

export function signal<V = undefined>(
  config: ReadOnlySignalConfig<V>,
): ReadOnlySignal<V>;

export function signal<
  T = undefined,
  V = undefined,
  Key extends string | undefined = undefined,
>(
  config: Partial<Config<T, Key>> | ReadOnlySignalConfig<V> = {},
): Signal<T, V, Key> | ReadOnlySignal<V> {
  const normalizedConfig: Config<T | undefined, string | undefined> = {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    default: (config as any).default,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    key: (config as any).key,
  };
  const { default: defaultValue } = normalizedConfig ?? {};
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const subject = new BehaviorSubject(defaultValue as any);

  const setValue = <F extends (prev: T) => T>(
    arg: T | F | typeof SIGNAL_RESET,
  ) => {
    const update = (value: T | undefined) => {
      subject.next(value);
    };

    if (typeof arg === "function") {
      const change = (arg as F)(subject.getValue());

      if (change === subject.getValue()) return;

      return update(change);
    }

    if (arg === SIGNAL_RESET) {
      if (defaultValue === subject.getValue()) return;

      return update((defaultValue ?? undefined) as T);
    }

    if (arg === subject.getValue()) return;

    return update(arg);
  };

  const getValue = () => subject.getValue();

  /**
   * Read Only signals
   */
  if ("get" in config) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const getter = (signal: Signal<any, any, any>) => {
      signal.subject.pipe(skip(1), first()).subscribe(() => {
        const newValue = config.get?.(getter);

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        setValue(newValue as any);
      });

      return signal.getValue();
    };

    const defaultValue = config.get(getter);

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    setValue(defaultValue as any);

    return {
      getValue,
      config,
      subject,
    };
  }

  return {
    setValue,
    getValue,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    config: normalizedConfig as any,
    subject,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type SignalValue<S extends Signal<any, any, any>> = ReturnType<
  S["getValue"]
>;
