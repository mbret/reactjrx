/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable new-cap */
import { StrictMode, memo, useState } from "react"
import ReactDOM from "react-dom/client"
import { useMutation } from "./lib/queries/react/mutations/useMutation"
import {
  QueryClient as rc_QueryClient,
  QueryClientProvider as RcQueryClientProvider,
  useMutation as rcUseMutation
} from "@tanstack/react-query"
import { sleep } from "./tests/utils"
import { useIsMutating } from "./lib/queries/react/mutations/useIsMutating"
import { QueryClient } from "./lib/queries/client/QueryClient"
import { MutationCache } from "./lib/queries/client/mutations/cache/MutationCache"
import { signal } from "./lib/state/signal"
import { QueryClientProvider } from "./lib/queries/react/QueryClientProvider"
import { SIGNAL_RESET } from "./lib/state/constants"

const rcClient = new rc_QueryClient()
const mutationCache = new MutationCache()
const client = new QueryClient({
  mutationCache
})

const myState = signal({
  key: "myState",
  default: 2
})

const IsMutating = memo(() => {
  console.log(
    "useIsMutating",
    useIsMutating({
      predicate: (mutation) => mutation.options.mutationKey?.[0] === "mutation1"
    })
  )

  return null
})

const Mutation = memo((_: { onClick: () => void }) => {
  const { mutate, ...rest } = useMutation({
    mutationKey: ["mutation1"],
    retry: 1,
    mutationFn: async ({ time }: { v: string; time: number }) => {
      console.log("MUTATE")
      await sleep(time)
      throw new Error("sad")
      // return v
    },
    onMutate: () => "foo",
    onSettled: (...args) => {
      console.log("onSettled", ...args)
    }
  })
  rcUseMutation({
    mutationKey: ["mutation2"],
    mutationFn: async ({ time, v }: { v: string; time: number }) => {
      await sleep(time)

      return v
    }
  })

  // mutate2({}, {
  //   onSuccess: () => {}
  // })
  console.log("mutate", rest)
  // console.log("mutate2", mutation2Result)

  return (
    <div style={{ display: "flex", border: "1px solid red" }}>
      mutation
      <IsMutating />
      <button
        onClick={() => {
          mutate({ v: "data1", time: 2000 })
          // mutate2({ v: "data1", time: 1000 })

          setTimeout(() => {
            // onClick()
          }, 5000)
        }}
      >
        click
      </button>
    </div>
  )
})

const App = memo(() => {
  const [isMutationMounted, setIsMutationMounted] = useState(true)

  // usePersistSignals({
  //   entries: [{ version: 1, signal: myState }],
  //   adapter: createSharedStoreAdapter({
  //     adapter: createLocalStorageAdapter(localStorage),
  //     key: "foo"
  //   }),
  //   onReady: () => {
  //     // console.log("onReady")
  //   }
  // })

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
          console.log("reset")
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

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <RcQueryClientProvider client={rcClient}>
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>
    </RcQueryClientProvider>
  </StrictMode>
)
