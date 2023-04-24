import { Observable } from "rxjs"
import { signal } from "../signal"

type Return<T> = [
  () => Promise<void>,
  () => Promise<void>,
  Observable<T>,
  { key?: string }
]

export function withPersistance<T>(
  _signal: ReturnType<typeof signal<T>>,
  { version = 0 }: { version?: number } = {}
): [Return<T>, ...ReturnType<typeof signal<T>>] {
  const [hook, setState, getState, state$, options] = _signal

  if (!options.key) {
    console.error(
      "You need to specify a key to use persistance with this signal"
    )
  }

  const hydrate = async () => {
    if (!options.key) return

    const value = localStorage.getItem(options.key)

    if (!value) return

    const hydratedValue = JSON.parse(value)

    if (version > hydratedValue.migration.version) {
      return
    }

    setState(hydratedValue.value)

    console.log(`hydrate ${options.key}`, hydratedValue)
  }

  const persist = async () => {
    if (!options.key) return

    const state = getState()

    const value = JSON.stringify({ value: state, migration: { version } })

    localStorage.setItem(options.key, value)

    console.log(`persist ${options.key}`, value)
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
