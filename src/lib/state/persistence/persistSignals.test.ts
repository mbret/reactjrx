import { firstValueFrom, of, type Subscription } from "rxjs"
import { afterEach, describe, expect, it } from "vitest"
import { waitForTimeout } from "../../../tests/utils"
import { signal } from "../Signal"
import { createLocalStorageAdapter } from "./adapters/createLocalStorageAdapter"
import { MockAdapter } from "./adapters/MockAdapter"
import { IDENTIFIER_PERSISTENCE_KEY } from "./constants"
import { persistSignals } from "./persistSignals"
import type { PersistenceEntry, SignalPersistenceConfig } from "./types"

afterEach(() => {
  localStorage.clear()
})

const storedEntry = (value: unknown, migrationVersion: number) =>
  JSON.stringify({
    [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
    value,
    migrationVersion,
  } satisfies PersistenceEntry)

const persistUntilStopped = async (
  // biome-ignore lint/suspicious/noExplicitAny: any signal can be persisted
  entries: SignalPersistenceConfig<any>[],
) => {
  let subscription: Subscription | undefined

  await new Promise<void>((resolve) => {
    subscription = persistSignals({
      entries$: of(entries),
      adapter: createLocalStorageAdapter(),
      onHydrated: resolve,
    }).subscribe()
  })

  return () => subscription?.unsubscribe()
}

describe("Given a storage that never resolves", () => {
  it("should not hydrate", async () => {
    const mockAdapter = new MockAdapter({}, { resolve: false })
    const mySignal = signal({ default: 0, key: "key" })

    const persistance$ = persistSignals({
      entries$: of([{ signal: mySignal, version: 0 }]),
      adapter: mockAdapter,
    })

    const value = await Promise.race([
      firstValueFrom(persistance$),
      waitForTimeout(100),
    ])

    expect(value).toBe(undefined)
  })
})

describe("Given an empty storage", () => {
  it("should hydrate but not overwrite", async () => {
    const mockAdapter = new MockAdapter({})
    const mySignal = signal({ default: 0, key: "key" })

    const persistance$ = persistSignals({
      entries$: of([{ signal: mySignal, version: 0 }]),
      adapter: mockAdapter,
    })

    const value = await firstValueFrom(persistance$)

    expect(value).toEqual({ type: "hydrated" })
    expect(mySignal.getValue()).toEqual(0)
  })
})

describe("Given an invalid stored value", () => {
  it("should hydrate but not overwrite", async () => {
    const mockAdapter = new MockAdapter({ key: 5 })
    const mySignal = signal({ default: 0, key: "key" })

    const persistance$ = persistSignals({
      entries$: of([{ signal: mySignal, version: 0 }]),
      adapter: mockAdapter,
    })

    await firstValueFrom(persistance$)

    expect(mySignal.getValue()).toEqual(0)
  })
})

describe("Given a valid stored value", () => {
  it("should hydrate and overwrite", async () => {
    const mockAdapter = new MockAdapter({
      key: {
        [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
        value: 5,
        migrationVersion: 0,
      } satisfies PersistenceEntry,
    })
    const mySignal = signal({ default: 0, key: "key" })

    const persistance$ = persistSignals({
      entries$: of([{ signal: mySignal, version: 0 }]),
      adapter: mockAdapter,
    })

    await firstValueFrom(persistance$)

    expect(mySignal.getValue()).toEqual(5)
  })
})

describe("Given a new signal version", () => {
  describe("when a storage value already exist with no version", () => {
    it("should hydrate and not overwrite", async () => {
      const mockAdapter = new MockAdapter({
        key: {
          [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
          value: 5,
        } satisfies PersistenceEntry,
      })
      const mySignal = signal({ default: 0, key: "key" })

      const persistance$ = persistSignals({
        entries$: of([{ signal: mySignal, version: 0 }]),
        adapter: mockAdapter,
      })

      await firstValueFrom(persistance$)

      expect(mySignal.getValue()).toEqual(0)
    })
  })

  describe("when a storage value already exist with inferior version", () => {
    it("should hydrate and overwrite", async () => {
      const mockAdapter = new MockAdapter({
        key: {
          [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
          value: 5,
          migrationVersion: 1,
        } satisfies PersistenceEntry,
      })
      const mySignal = signal({ default: 0, key: "key" })

      const persistance$ = persistSignals({
        entries$: of([{ signal: mySignal, version: 2 }]),
        adapter: mockAdapter,
      })

      await firstValueFrom(persistance$)

      expect(mySignal.getValue()).toEqual(0)
    })
  })

  describe("when a storage value already exist with superior version", () => {
    it("should hydrate and overwrite", async () => {
      const mockAdapter = new MockAdapter({
        key: {
          [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
          value: 5,
          migrationVersion: 3,
        } satisfies PersistenceEntry,
      })
      const mySignal = signal({ default: 0, key: "key" })

      const persistance$ = persistSignals({
        entries$: of([{ signal: mySignal, version: 2 }]),
        adapter: mockAdapter,
      })

      await firstValueFrom(persistance$)

      expect(mySignal.getValue()).toEqual(5)
    })
  })
})

describe("Given a stored value with a newer version", () => {
  it("should leave it as stored when an older version hydrates from it", async () => {
    localStorage.setItem("key", storedEntry(5, 3))
    const olderSignal = signal({ default: 0, key: "key" })

    const stop = await persistUntilStopped([
      { signal: olderSignal, version: 2 },
    ])
    stop()

    expect(olderSignal.getValue()).toBe(5)
    expect(JSON.parse(localStorage.getItem("key") ?? "")).toEqual(
      JSON.parse(storedEntry(5, 3)),
    )

    const newerSignal = signal({ default: 0, key: "key" })

    await firstValueFrom(
      persistSignals({
        entries$: of([{ signal: newerSignal, version: 3 }]),
        adapter: createLocalStorageAdapter(),
      }),
    )

    expect(newerSignal.getValue()).toBe(5)
  })
})

describe("Given a signal set to undefined", () => {
  it("should hydrate undefined, not the default", async () => {
    const lang = signal<string | undefined, "lang">({
      key: "lang",
      default: "en",
    })

    const stop = await persistUntilStopped([{ signal: lang, version: 0 }])
    lang.update(undefined)
    stop()

    const reloaded = signal<string | undefined, "lang">({
      key: "lang",
      default: "en",
    })

    await firstValueFrom(
      persistSignals({
        entries$: of([{ signal: reloaded, version: 0 }]),
        adapter: createLocalStorageAdapter(),
      }),
    )

    expect(reloaded.getValue()).toBe(undefined)
  })
})

describe("Given a signal changed when it is hydrated", () => {
  it("should save its new value at once", async () => {
    localStorage.setItem("key", storedEntry(5, 0))
    const mySignal = signal({ default: 0, key: "key" })

    const subscription = persistSignals({
      entries$: of([{ signal: mySignal, version: 0 }]),
      adapter: createLocalStorageAdapter(),
      onHydrated: () => mySignal.update(7),
    }).subscribe()

    await waitForTimeout(20)

    expect(JSON.parse(localStorage.getItem("key") ?? "")).toEqual(
      JSON.parse(storedEntry(7, 0)),
    )

    subscription.unsubscribe()
  })
})
