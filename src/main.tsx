/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable new-cap */
import { StrictMode, memo } from "react"
import ReactDOM from "react-dom/client"
import { useMutation } from "./lib/queries/react/mutations/useMutation"
import {
  QueryClient as rc_QueryClient,
  QueryClientProvider as RcQueryClientProvider,
  MutationCache as RQMutationCache
} from "@tanstack/react-query"
import { QueryClient } from "./lib/queries/client/QueryClient"
import { MutationCache } from "./lib/queries/client/mutations/cache/MutationCache"
import { QueryClientProvider } from "./lib/queries/react/QueryClientProvider"
import { ignoreElements, interval, tap } from "rxjs"

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

const App = memo(() => {
  const { mutate, reset, isPending, data } = useMutation({
    mutationFn: () =>
      interval(1000).pipe(
        tap((v) => {
          console.log("value", v)
        }),
        ignoreElements()
      )
  })

  return (
    <>
      <div>
        {String(isPending)} {data ?? 0}
      </div>
      <button
        onClick={() => {
          mutate()
        }}
      >
        click
      </button>
      <button
        onClick={() => {
          reset()
        }}
      >
        reset
      </button>
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
