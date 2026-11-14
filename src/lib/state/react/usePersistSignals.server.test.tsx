// @vitest-environment node
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { signal } from "../Signal"
import { usePersistSignals } from "./usePersistSignals"

describe("Given a server render", () => {
  it("should not read or write the adapter", () => {
    const signalA = signal({ default: 0, key: "a" })
    const adapter = {
      getItem: vi.fn(async () => undefined),
      setItem: vi.fn(async () => undefined),
    }

    function App() {
      "use no memo"
      const { isHydrated } = usePersistSignals({
        entries: [{ signal: signalA, version: 0 }],
        adapter,
      })

      return <>{String(isHydrated)}</>
    }

    expect(renderToString(<App />)).toBe("false")
    expect(adapter.getItem).not.toHaveBeenCalled()
    expect(adapter.setItem).not.toHaveBeenCalled()
  })
})
