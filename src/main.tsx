/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable new-cap */
import { StrictMode, memo } from "react"
import ReactDOM from "react-dom/client"
import {
  QueryClient as rc_QueryClient,
  QueryClientProvider as RcQueryClientProvider,
  MutationCache as RQMutationCache
} from "@tanstack/react-query"
import { QueryClient } from "./lib/queries/client/QueryClient"
import { MutationCache } from "./lib/queries/client/mutations/cache/MutationCache"
import { QueryClientProvider } from "./lib/queries/react/QueryClientProvider"
import { usePersistSignals } from "./lib/state/react/usePersistSignals"
import { signal } from "./lib/state/signal"
import { createLocalStorageAdapter } from "./lib/state/persistance/adapters/createLocalStorageAdapter"

const rcClient = new rc_QueryClient({
  mutationCache: new RQMutationCache({
    onError: (error) => {
      console.log("cache onError", error)
    }
  })
})

const client = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      console.log("cache onError", error)
    }
  })
})

const mySignal = signal({ default: 0, key: "foo" })
const adapter = createLocalStorageAdapter()

const App = memo(() => {
  const persistance = usePersistSignals({
    entries: [{ signal: mySignal, version: 0 }],
    adapter,
    onHydrated: () => {
      console.log("onHydrated")
    }
  })

  console.log(persistance)

  return (
    <>
      <button
        onClick={() => {
          mySignal.setValue(s => s + 1)
        }}
      >
        click
      </button>
      {/* <div>
        {String(isPending)} {data ?? 0}
      </div>
      
      <button
        onClick={() => {
          reset()
        }}
      >
        reset
      </button> */}
    </>
  )
})

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <RcQueryClientProvider client={rcClient}>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </RcQueryClientProvider>
  </StrictMode>
)
