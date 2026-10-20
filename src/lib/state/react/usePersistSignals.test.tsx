import { renderHook, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import { waitForTimeout } from "../../../tests/utils"
import type { Adapter } from "../persistence/adapters/Adapter"
import { IDENTIFIER_PERSISTENCE_KEY } from "../persistence/constants"
import type {
  PersistenceEntry,
  SignalPersistenceConfig,
} from "../persistence/types"
import { signal } from "../Signal"
import { usePersistSignals } from "./usePersistSignals"

// biome-ignore lint/suspicious/noExplicitAny: test
type Entries = Array<SignalPersistenceConfig<any>>

const storedValue = (value: unknown) =>
  ({
    [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
    value,
    migrationVersion: 0,
  }) satisfies PersistenceEntry

const createMemoryAdapter = (
  storage: Record<string, unknown> = {},
): Adapter & {
  storage: Record<string, unknown>
  calls: { getItem: number; setItem: number }
} => {
  const calls = { getItem: 0, setItem: 0 }

  return {
    storage,
    calls,
    getItem: async (key: string) => {
      calls.getItem++

      return storage[key]
    },
    setItem: async (key: string, value: unknown) => {
      calls.setItem++
      storage[key] = value
    },
    removeItem: async (key: string) => {
      delete storage[key]
    },
    clear: async () => {},
  }
}

const storedValueOf = (
  adapter: { storage: Record<string, unknown> },
  key: string,
) => (adapter.storage[key] as PersistenceEntry | undefined)?.value

const renderPersistSignals = (initialProps: {
  entries: Entries
  adapter: Adapter | undefined
}) =>
  renderHook(
    ({ entries, adapter }: typeof initialProps) =>
      usePersistSignals({ entries, adapter }),
    { initialProps },
  )

describe("Given an entry added after the initial hydration", () => {
  it("should hydrate and persist the new entry", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const adapter = createMemoryAdapter({ b: storedValue(7) })
    const onHydrated = vi.fn()

    const { result, rerender } = renderHook(
      ({ entries }: { entries: Entries }) =>
        usePersistSignals({ entries, adapter, onHydrated }),
      {
        initialProps: { entries: [{ signal: signalA, version: 0 }] as Entries },
      },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(0)

    rerender({
      entries: [
        { signal: signalA, version: 0 },
        { signal: signalB, version: 0 },
      ],
    })

    await waitFor(() => {
      expect(signalB.getValue()).toBe(7)
    })

    // Both only describe the first hydration.
    expect(onHydrated).toHaveBeenCalledTimes(1)
    expect(result.current.isHydrated).toBe(true)

    signalB.update(9)

    await waitFor(
      () => {
        expect(storedValueOf(adapter, "b")).toBe(9)
      },
      { timeout: 2000 },
    )
  })
})

describe("Given an entries change while a write is still throttled", () => {
  it("should keep the newer in-memory value of an already hydrated entry", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const adapter = createMemoryAdapter({ a: storedValue(1) })

    const { result, rerender } = renderHook(
      ({ entries }: { entries: Entries }) =>
        usePersistSignals({ entries, adapter }),
      {
        initialProps: { entries: [{ signal: signalA, version: 0 }] as Entries },
      },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalA.getValue()).toBe(1)

    // Both updates fall in the 500 ms throttle window opened by the write
    // that follows hydration, so they are still pending when the entries
    // change.
    signalA.update(2)
    signalA.update(3)

    rerender({
      entries: [
        { signal: signalA, version: 0 },
        { signal: signalB, version: 0 },
      ],
    })

    await waitFor(
      () => {
        expect(storedValueOf(adapter, "a")).toBe(3)
      },
      { timeout: 2000 },
    )

    expect(signalA.getValue()).toBe(3)
  })
})

describe("Given a new entries array on every render", () => {
  it("should not read, write or call onHydrated again", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const adapter = createMemoryAdapter({ a: storedValue(1) })
    const onHydrated = vi.fn()

    const { result, rerender } = renderHook(() =>
      usePersistSignals({
        entries: [{ signal: signalA, version: 0 }],
        adapter,
        onHydrated,
      }),
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    const callsAfterHydration = { ...adapter.calls }

    for (let i = 0; i < 5; i++) {
      rerender()
    }

    await waitForTimeout(50)

    expect(adapter.calls).toEqual(callsAfterHydration)
    expect(onHydrated).toHaveBeenCalledTimes(1)
  })
})

describe("Given an entry removed while a write is still throttled", () => {
  it("should save its pending value, then stop persisting it", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const adapter = createMemoryAdapter()
    const initialEntries: Entries = [{ signal: signalA, version: 0 }]

    const { result, rerender } = renderHook(
      ({ entries }: { entries: Entries }) =>
        usePersistSignals({ entries, adapter }),
      { initialProps: { entries: initialEntries } },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Held by the throttle window opened by the write that follows hydration.
    signalA.update(1)

    rerender({ entries: [] })

    await waitFor(() => {
      expect(storedValueOf(adapter, "a")).toBe(1)
    })

    signalA.update(2)

    await waitForTimeout(700)

    expect(storedValueOf(adapter, "a")).toBe(1)
  })
})

describe("Given an entry removed then added again", () => {
  it("should hydrate it from the adapter again", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const adapter = createMemoryAdapter({ a: storedValue(1) })
    const entriesWithA: Entries = [{ signal: signalA, version: 0 }]

    const { result, rerender } = renderHook(
      ({ entries }: { entries: Entries }) =>
        usePersistSignals({ entries, adapter }),
      { initialProps: { entries: entriesWithA } },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalA.getValue()).toBe(1)

    rerender({ entries: [] })

    // Written by something else while the entry is not persisted.
    adapter.storage.a = storedValue(5)

    rerender({ entries: entriesWithA })

    await waitFor(() => {
      expect(signalA.getValue()).toBe(5)
    })
  })
})

describe("Given the hook unmounts while a write is still throttled", () => {
  it("should save the pending value", { timeout: 3000 }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const adapter = createMemoryAdapter()
    const entries: Entries = [{ signal: signalA, version: 0 }]

    const { result, unmount } = renderHook(() =>
      usePersistSignals({ entries, adapter }),
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Held by the throttle window opened by the write that follows hydration.
    signalA.update(1)

    unmount()

    await waitFor(() => {
      expect(storedValueOf(adapter, "a")).toBe(1)
    })
  })
})

describe("Given the adapter changes while a write is still throttled", () => {
  it("should save the pending value to the previous adapter", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const previousAdapter = createMemoryAdapter()
    const nextAdapter = createMemoryAdapter({ a: storedValue(9) })
    const entries: Entries = [{ signal: signalA, version: 0 }]

    const { result, rerender } = renderHook(
      ({ adapter }: { adapter: Adapter }) =>
        usePersistSignals({ entries, adapter }),
      { initialProps: { adapter: previousAdapter as Adapter } },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // Held by the throttle window opened by the write that follows hydration.
    signalA.update(1)

    rerender({ adapter: nextAdapter })

    await waitFor(() => {
      expect(storedValueOf(previousAdapter, "a")).toBe(1)
    })

    await waitFor(() => {
      expect(signalA.getValue()).toBe(9)
    })
  })
})

describe("Given StrictMode", () => {
  it("should hydrate without overwriting the stored value first", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const adapter = createMemoryAdapter({ a: storedValue(1) })
    const entries: Entries = [{ signal: signalA, version: 0 }]
    const storedValues: unknown[] = []
    const { setItem } = adapter

    adapter.setItem = (key, value) => {
      storedValues.push((value as PersistenceEntry).value)

      return setItem(key, value)
    }

    const { result } = renderHook(
      () => usePersistSignals({ entries, adapter }),
      { wrapper: StrictMode },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalA.getValue()).toBe(1)
    expect(storedValues).not.toContain(0)
    expect(storedValueOf(adapter, "a")).toBe(1)
  })
})

describe("Given a mount with browser timing", () => {
  /**
   * Outside `act`, effects run after pending promises resolve, as in a
   * browser, so hydration can finish before the mount effects run.
   */
  it("should hydrate once and call onHydrated once", {
    timeout: 3000,
  }, async () => {
    const actEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT")
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false)

    const root = createRoot(document.createElement("div"))

    try {
      const signalA = signal({ default: 0, key: "a" })
      const adapter = createMemoryAdapter({ a: storedValue(1) })
      const entries: Entries = [{ signal: signalA, version: 0 }]
      const onHydrated = vi.fn()

      function Component() {
        usePersistSignals({ entries, adapter, onHydrated })

        return null
      }

      root.render(<Component />)

      await waitFor(() => {
        expect(onHydrated).toHaveBeenCalled()
      })

      await waitForTimeout(100)

      expect(signalA.getValue()).toBe(1)
      expect(onHydrated).toHaveBeenCalledTimes(1)
      expect(adapter.calls.getItem).toBe(1)
    } finally {
      root.unmount()
      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", actEnvironment)
    }
  })
})

describe("Given an adapter that replaces another one", () => {
  const renderWithAdapter = (entries: Entries, adapter: Adapter | undefined) =>
    renderHook(
      ({ adapter }: { adapter: Adapter | undefined }) =>
        usePersistSignals({ entries, adapter }),
      { initialProps: { adapter } },
    )

  it("should reset an entry with nothing stored to its default", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const previousAdapter = createMemoryAdapter({ a: storedValue(5) })
    const nextAdapter = createMemoryAdapter()

    const { result, rerender } = renderWithAdapter(
      [{ signal: signalA, version: 0 }],
      previousAdapter,
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalA.getValue()).toBe(5)

    rerender({ adapter: nextAdapter })

    await waitFor(() => {
      expect(signalA.getValue()).toBe(0)
    })

    await waitFor(() => {
      expect(storedValueOf(nextAdapter, "a")).toBe(0)
    })

    expect(storedValueOf(previousAdapter, "a")).toBe(5)
  })

  it("should reset it after a gap without adapter, as on a sign-out", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const previousAdapter = createMemoryAdapter({ a: storedValue(5) })
    const nextAdapter = createMemoryAdapter()

    const { result, rerender } = renderWithAdapter(
      [{ signal: signalA, version: 0 }],
      previousAdapter,
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    rerender({ adapter: undefined })

    expect(signalA.getValue()).toBe(5)

    rerender({ adapter: nextAdapter })

    await waitFor(() => {
      expect(signalA.getValue()).toBe(0)
    })

    await waitFor(() => {
      expect(storedValueOf(nextAdapter, "a")).toBe(0)
    })
  })

  it("should reset an entry whose stored version is older to its default", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const previousAdapter = createMemoryAdapter({
      a: { ...storedValue(5), migrationVersion: 1 },
    })
    const nextAdapter = createMemoryAdapter({ a: storedValue(7) })

    const { result, rerender } = renderWithAdapter(
      [{ signal: signalA, version: 1 }],
      previousAdapter,
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalA.getValue()).toBe(5)

    rerender({ adapter: nextAdapter })

    await waitFor(() => {
      expect(signalA.getValue()).toBe(0)
    })
  })
})

describe("Given an entry added after an adapter replaced another one", () => {
  it("should reset it to its default when nothing is stored", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const previousAdapter = createMemoryAdapter({
      a: storedValue(1),
      b: storedValue(5),
    })
    const nextAdapter = createMemoryAdapter()
    const entriesWithB: Entries = [
      { signal: signalA, version: 0 },
      { signal: signalB, version: 0 },
    ]
    const entriesWithoutB: Entries = [{ signal: signalA, version: 0 }]

    const { result, rerender } = renderPersistSignals({
      entries: entriesWithB,
      adapter: previousAdapter,
    })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(5)

    // `b` leaves the list, the adapter changes, then `b` comes back.
    rerender({ entries: entriesWithoutB, adapter: previousAdapter })
    rerender({ entries: entriesWithoutB, adapter: nextAdapter })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    rerender({ entries: entriesWithB, adapter: nextAdapter })

    await waitFor(() => {
      expect(signalB.getValue()).toBe(0)
    })

    await waitFor(() => {
      expect(storedValueOf(nextAdapter, "b")).toBe(0)
    })
  })
})

describe("Given the first adapter back after another one", () => {
  it("should reset an entry with nothing stored to its default", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const firstAdapter = createMemoryAdapter()
    const otherAdapter = createMemoryAdapter({ b: storedValue(5) })
    const entriesWithB: Entries = [
      { signal: signalA, version: 0 },
      { signal: signalB, version: 0 },
    ]

    const { result, rerender } = renderPersistSignals({
      entries: [{ signal: signalA, version: 0 }],
      adapter: firstAdapter,
    })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    rerender({ entries: entriesWithB, adapter: otherAdapter })

    await waitFor(() => {
      expect(signalB.getValue()).toBe(5)
    })

    rerender({ entries: entriesWithB, adapter: firstAdapter })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(0)

    await waitFor(() => {
      expect(storedValueOf(firstAdapter, "b")).toBe(0)
    })

    expect(storedValueOf(otherAdapter, "b")).toBe(5)
  })
})

describe("Given the same adapter back after a gap without adapter", () => {
  it("should keep the in-memory value of an entry with nothing stored", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const adapter = createMemoryAdapter()
    const entriesWithB: Entries = [
      { signal: signalA, version: 0 },
      { signal: signalB, version: 0 },
    ]
    const entriesWithoutB: Entries = [{ signal: signalA, version: 0 }]

    const { result, rerender } = renderPersistSignals({
      entries: entriesWithoutB,
      adapter,
    })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    // The adapter goes away, `b` changes, then the adapter comes back with `b`.
    rerender({ entries: entriesWithoutB, adapter: undefined })

    signalB.update(3)

    rerender({ entries: entriesWithB, adapter })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(3)

    await waitFor(() => {
      expect(storedValueOf(adapter, "b")).toBe(3)
    })
  })

  it("should still reset an entry with nothing stored when that adapter replaced another one", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const previousAdapter = createMemoryAdapter({ b: storedValue(5) })
    const adapter = createMemoryAdapter()
    const entriesWithB: Entries = [
      { signal: signalA, version: 0 },
      { signal: signalB, version: 0 },
    ]
    const entriesWithoutB: Entries = [{ signal: signalA, version: 0 }]

    const { result, rerender } = renderPersistSignals({
      entries: entriesWithB,
      adapter: previousAdapter,
    })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(5)

    // `b` leaves the list with the previous adapter's value, the adapter
    // changes, goes away, then comes back with `b`.
    rerender({ entries: entriesWithoutB, adapter: previousAdapter })
    rerender({ entries: entriesWithoutB, adapter })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    rerender({ entries: entriesWithoutB, adapter: undefined })
    rerender({ entries: entriesWithB, adapter })

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(0)

    await waitFor(() => {
      expect(storedValueOf(adapter, "b")).toBe(0)
    })
  })
})

describe("Given a value set before the first hydration", () => {
  for (const { name, initialAdapter, wrapper } of [
    { name: "an adapter at mount", initialAdapter: true, wrapper: undefined },
    {
      name: "an adapter at mount in StrictMode",
      initialAdapter: true,
      wrapper: StrictMode,
    },
    {
      name: "no adapter at mount, then a first one",
      initialAdapter: false,
      wrapper: undefined,
    },
  ]) {
    it(`should keep it when nothing is stored, with ${name}`, {
      timeout: 3000,
    }, async () => {
      const signalA = signal({ default: 0, key: "a" })
      const adapter = createMemoryAdapter()
      const entries: Entries = [{ signal: signalA, version: 0 }]

      signalA.update(3)

      const { result, rerender } = renderHook(
        ({ adapter }: { adapter: Adapter | undefined }) =>
          usePersistSignals({ entries, adapter }),
        {
          initialProps: { adapter: initialAdapter ? adapter : undefined },
          wrapper,
        },
      )

      if (!initialAdapter) rerender({ adapter })

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true)
      })

      expect(signalA.getValue()).toBe(3)

      await waitFor(() => {
        expect(storedValueOf(adapter, "a")).toBe(3)
      })
    })
  }
})

describe("Given an entry added later with nothing stored", () => {
  it("should keep its in-memory value", { timeout: 3000 }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })
    const adapter = createMemoryAdapter()

    const { result, rerender } = renderHook(
      ({ entries }: { entries: Entries }) =>
        usePersistSignals({ entries, adapter }),
      {
        initialProps: { entries: [{ signal: signalA, version: 0 }] as Entries },
      },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    signalB.update(3)

    rerender({
      entries: [
        { signal: signalA, version: 0 },
        { signal: signalB, version: 0 },
      ],
    })

    await waitFor(() => {
      expect(storedValueOf(adapter, "b")).toBe(3)
    })

    expect(signalB.getValue()).toBe(3)
  })
})
