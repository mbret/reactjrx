import { Observable } from "rxjs"
import { signal } from "../signal"
import { Adapter, PersistanceEntry } from "./types"
import { getNormalizedPersistanceValue } from "./getNormalizedPersistanceValue"

type WithPersistanceReturn<T> = [
  (params: { adapter: Adapter }) => Promise<void>,
  (params: { adapter: Adapter }) => Promise<void>,
  Observable<T>,
  { key?: string }
]

export function withPersistance<T>(
  _signal: ReturnType<typeof signal<T>>,
  { version = 0 }: { version?: number } = {}
): [WithPersistanceReturn<T>, ...ReturnType<typeof signal<T>>] {
  const [hook, setState, getState, state$, options] = _signal

  if (!options.key) {
    console.error(
      "You need to specify a key to use persistance with this signal"
    )
  }

  const hydrate = async ({
    adapter,
    key = options.key
  }: {
    adapter: Adapter
    key?: string
  }) => {
    if (!key) return

    const value = await adapter.getItem(key)

    const normalizedValue = getNormalizedPersistanceValue(value)

    if (!normalizedValue) return

    if (
      normalizedValue.migrationVersion &&
      version > normalizedValue.migrationVersion
    ) {
      return
    }

    setState((value as any).value)
  }

  const persist = async ({
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
    [hydrate, persist, state$, options],
    hook,
    setState,
    getState,
    state$,
    options
  ]
}
