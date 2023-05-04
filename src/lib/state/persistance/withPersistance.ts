import { type Observable } from "rxjs"
import { type signal } from "../signal"
import { type Adapter, type PersistanceEntry } from "./types"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"

interface WithPersistanceReturn<T> {
  hydrateValue: (params: { adapter: Adapter }) => Promise<void>
  persistValue: (params: { adapter: Adapter }) => Promise<void>
  setValue: ReturnType<typeof signal<T>>[1]
  $: Observable<T>
  options: { key?: string }
}

export function withPersistance<T>(
  _signal: ReturnType<typeof signal<T>>,
  { version = 0 }: { version?: number } = {}
): [WithPersistanceReturn<T>, ...ReturnType<typeof signal<T>>] {
  const [hook, setValue, getState, $, options, ...rest] = _signal

  if (!options.key) {
    console.error(
      "You need to specify a key to use persistance with this signal"
    )
  }

  const hydrateValue = async ({
    adapter,
    key = options.key
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

    setValue((value as any).value)
  }

  const persistValue = async ({
    adapter,
    key = options.key
  }: {
    adapter: Adapter
    key?: string
  }) => {
    if (!key) return

    const state = getState()

    const value = {
      value: state,
      __key: "reactjrx_persistance",
      migrationVersion: version
    } satisfies PersistanceEntry

    await adapter.setItem(key, value)
  }

  return [
    { hydrateValue, persistValue, setValue, $, options },
    hook,
    setValue,
    getState,
    $,
    options,
    ...rest
  ]
}
