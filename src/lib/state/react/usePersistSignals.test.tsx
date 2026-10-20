import { renderHook, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
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
