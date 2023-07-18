import type { Signal } from "../signal"
import { type Adapter, type PersistanceEntry } from "./types"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"

export interface WithPersistanceReturn<T> {
  hydrateValue: (params: { adapter: Adapter }) => Promise<void>
  persistValue: (params: { adapter: Adapter }) => Promise<void>
  setValue: Signal<T, T>['setState']
  $: Signal<T, T>['subject']
  options: { key?: string }
}

export function withPersistance<T>(
  _signal: Signal<T, T>,
  { version = 0 }: { version?: number } = {}
): [WithPersistanceReturn<T>, Signal<T, T>] {
  // const [hook, setValue, getState, $, options, ...rest] = _signal

  if (!_signal.options.key) {
    console.error(
      "You need to specify a key to use persistance with this signal"
    )
  }

  const hydrateValue = async ({
    adapter,
    key = _signal.options.key
  }: {
    adapter: Adapter
    key?: string
  }) => {
    if (!key) return

    const value = await adapter.getItem(key)

    const normalizedValue = getNormalizedPersistanceValue(value)

    if (normalizedValue == null) return

    if (
      normalizedValue.migrationVersion &&
      version > normalizedValue.migrationVersion
    ) {
      return
    }

    _signal.setState((value as any).value)
  }

  const persistValue = async ({
    adapter,
    key = _signal.options.key
  }: {
    adapter: Adapter
    key?: string
  }) => {
    if (!key) return

    const state = _signal.getValue()

    const value = {
      value: state,
      __key: "reactjrx_persistance",
      migrationVersion: version
    } satisfies PersistanceEntry

    await adapter.setItem(key, value)
  }

  return [
    {
      hydrateValue,
      persistValue,
      setValue: _signal.setState,
      $: _signal.subject,
      options: _signal.options
    },
    _signal
  ]
}
