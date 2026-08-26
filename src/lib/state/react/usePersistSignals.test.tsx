import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Adapter } from "../persistence/adapters/Adapter"
import { IDENTIFIER_PERSISTENCE_KEY } from "../persistence/constants"
import type {
  PersistenceEntry,
  SignalPersistenceConfig,
} from "../persistence/types"
import { signal } from "../Signal"
import { usePersistSignals } from "./usePersistSignals"

const createMemoryAdapter = (
  storage: Record<string, unknown> = {},
): Adapter & { storage: Record<string, unknown> } => ({
  storage,
  getItem: async (key: string) => storage[key],
  setItem: async (key: string, value: unknown) => {
    storage[key] = value
  },
  removeItem: async (key: string) => {
    delete storage[key]
  },
  clear: async () => {},
})

describe("Given an entry added after the initial hydration", () => {
  it("should hydrate and persist the new entry", {
    timeout: 3000,
  }, async () => {
    const signalA = signal({ default: 0, key: "a" })
    const signalB = signal({ default: 0, key: "b" })

    const adapter = createMemoryAdapter({
      b: {
        [IDENTIFIER_PERSISTENCE_KEY]: IDENTIFIER_PERSISTENCE_KEY,
        value: 7,
        migrationVersion: 0,
      } satisfies PersistenceEntry,
    })

    // biome-ignore lint/suspicious/noExplicitAny: test
    const initialEntries: Array<SignalPersistenceConfig<any>> = [
      { signal: signalA, version: 0 },
    ]
    // biome-ignore lint/suspicious/noExplicitAny: test
    const updatedEntries: Array<SignalPersistenceConfig<any>> = [
      { signal: signalA, version: 0 },
      { signal: signalB, version: 0 },
    ]

    const { result, rerender } = renderHook(
      ({ entries }) => usePersistSignals({ entries, adapter }),
      { initialProps: { entries: initialEntries } },
    )

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true)
    })

    expect(signalB.getValue()).toBe(0)

    rerender({ entries: updatedEntries })

    await waitFor(() => {
      expect(signalB.getValue()).toBe(7)
    })

    signalB.update(9)

    await waitFor(
      () => {
        expect((adapter.storage.b as PersistenceEntry | undefined)?.value).toBe(
          9,
        )
      },
      { timeout: 2000 },
    )
  })
})
