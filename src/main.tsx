/* eslint-disable new-cap */
import { memo, useState } from "react"
import ReactDOM from "react-dom/client"
import {
  QueryClient,
  QueryClientProvider,
  SIGNAL_RESET,
  createSharedStoreAdapter,
  signal,
  useMutation
} from "."
import { usePersistSignals } from "./lib/state/persistance/usePersistSignals"
import { createLocalStorageAdapter } from "./lib/state/persistance/adapters/createLocalStorageAdapter"
import {
  QueryClient as rc_QueryClient,
  QueryClientProvider as RcQueryClientProvider,
  useMutation as rc_useMutation
} from "@tanstack/react-query"

const rcClient = new rc_QueryClient()

const myState = signal({
  key: "myState",
  default: 2
})

const Mutation = memo((_: { onClick: () => void }) => {
  const result = useMutation({
    mutationFn: async ({ res, timeout }: { res: number; timeout: number }) => {
      return await new Promise<number>((resolve) =>
        setTimeout(() => {
          resolve(res)
        }, timeout)
      )
    },
    cancelOnUnMount: false,
    mapOperator: "merge",
    onSuccess: (data) => {
      console.log("success1", data)
    }
  })

  const result2 = rc_useMutation({
    mutationFn: async ({ res, timeout }: { res: number; timeout: number }) => {
      return await new Promise<number>((resolve) =>
        setTimeout(() => {
          resolve(res)
        }, timeout)
      )
    },
    onSuccess: () => {
      console.log("success2")
    }
  })

  const observeMut = useMutation({ mutationFn: async () => {} })

  console.log("mutation", result)
  console.log("rc", result2)
  console.log("observe", observeMut)

  return (
    <div style={{ display: "flex", border: "1px solid red" }}>
      mutation
      <button
        onClick={() => {
          result2.mutate({ res: 3, timeout: 1000 })
          // result.mutate({ res: 2, timeout: 2000 })
          result.mutate({ res: 3, timeout: 1000 })

          setTimeout(() => {
            // onClick()
          }, 100)
        }}
      >
        click
      </button>
    </div>
  )
})

const App = memo(() => {
  const [isMutationMounted, setIsMutationMounted] = useState(true)

  usePersistSignals({
    entries: [{ version: 1, signal: myState }],
    adapter: createSharedStoreAdapter({
      adapter: createLocalStorageAdapter(localStorage),
      key: "foo"
    }),
    onReady: () => {
      // console.log("onReady")
    }
  })

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
      {isMutationMounted && (
        <Mutation
          onClick={() => {
            setIsMutationMounted(false)
          }}
        />
      )}
    </>
  )
})

const client = new QueryClient()

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  // <React.StrictMode>
  <RcQueryClientProvider client={rcClient}>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </RcQueryClientProvider>
  // </React.StrictMode>
)
