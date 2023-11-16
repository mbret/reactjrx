import React, { memo } from "react"
import ReactDOM from "react-dom/client"
import {
  QueryClient,
  QueryClientProvider,
  SIGNAL_RESET,
  createSharedStoreAdapter,
  signal,
  useSignalValue
} from "."
import { usePersistSignals } from "./lib/state/persistance/usePersistSignals"
import { createLocalStorageAdapter } from "./lib/state/persistance/adapters/createLocalStorageAdapter"

const myState = signal({
  key: "myState",
  default: 2
})

const App = memo(() => {
  const stateValue = useSignalValue(myState)

  const { isHydrated } = usePersistSignals({
    entries: [{ version: 1, signal: myState }],
    adapter: createSharedStoreAdapter({
      adapter: createLocalStorageAdapter(localStorage),
      key: "foo"
    }),
    onReady: () => {
      console.log("onReady")
    }
  })

  console.log({ isHydrated, stateValue })

  return (
    <>
      <button
        onClick={() => {
          myState.setValue((v) => v + 1)
        }}
      >
        click
      </button>
      <button
        onClick={() => {
          myState.setValue(SIGNAL_RESET)
        }}
      >
        reset
      </button>
    </>
  )
})

const client = new QueryClient()

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
