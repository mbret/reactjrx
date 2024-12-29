/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable new-cap */
import { memo, StrictMode, useState } from "react"
import ReactDOM from "react-dom/client"
import {
  QueryClient as rc_QueryClient,
  QueryClientProvider as RcQueryClientProvider,
  MutationCache as RQMutationCache
} from "@tanstack/react-query"
import { QueryClient } from "./lib/deprecated/client/QueryClient"
import { MutationCache } from "./lib/deprecated/client/mutations/cache/MutationCache"
import { QueryClientProvider } from "./lib/deprecated/react/QueryClientProvider"
import { finalize, interval, map, tap, timer } from "rxjs"
import { useQuery$ } from "./lib/queries/useQuery$"
import { useSwitchMutation$ } from "./lib/queries/useSwitchMutation$"
import { QueryClientProvider$ } from "./lib/queries/QueryClientProvider$"

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

const Foo = memo(() => {
  const { data } = useQuery$({ queryKey: ["foo"], queryFn: () => timer(99999) })
  // const { data: data2 } = useQuery$({
  //   queryKey: ["foo"],
  //   queryFn: query
  // })

  console.log(data)

  return null
})

const App = memo(() => {
  // const [adapter, setAdapter] = useState<Adapter | undefined>()

  // const persistance = usePersistSignals({
  //   entries: [{ signal: mySignal, version: 0 }],
  //   adapter,
  //   onHydrated: () => {
  //     console.log("onHydrated")
  //   }
  // })

  // useEffect(() => {
  //   setTimeout(() => {
  //     setAdapter(createLocalStorageAdapter())

  //     setTimeout(() => {
  //       // console.log("set undefined")
  //       setAdapter(undefined)
  //     }, 1000)
  //   }, 1000)
  // }, [])

  const [hide, setHide] = useState(false)

  // const data = useQuery$({
  //   queryKey: ["foo", "bar"],
  //   queryFn: () => {
  //     // console.log("queryFn A")

  //     return interval(3000)
  //   },
  //   retry: false
  // })

  // const data = useQuery({
  //   queryKey: ["foo"],
  //   queryFn: async () => {
  //     console.log("queryFn")

  //     // rcClient.setQueryData(["foo"], "foo")

  //     await waitForTimeout(3000)

  //     return false
  //   },
  //   retry: false
  // })

  // console.log({ ...data })

  const mutation = useSwitchMutation$({
    mutationFn: (v) => {
      console.log("mutationFn", v)

      return interval(2000).pipe(
        tap(() => {
          console.log("tap")
        }),
        finalize(() => {
          console.log("finalize")
        }),
        map(() => "foo")
      )
    }
  })

  return (
    <>
      {/* <div>{data.data ?? 0}</div> */}
      <button
        onClick={() => {
          setHide((v) => !v)
        }}
      >
        toggle hide
      </button>
      <button onClick={() => mutation.mutate()}>mutate {mutation.data}</button>
      <button onClick={() => rcClient.cancelQueries({ queryKey: ["foo"] })}>
        cancel query
      </button>
      {hide ? <div>hidden</div> : <Foo />}
    </>
  )
})

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <RcQueryClientProvider client={rcClient}>
      <QueryClientProvider client={client}>
        <QueryClientProvider$>
          <App />
        </QueryClientProvider$>
      </QueryClientProvider>
    </RcQueryClientProvider>
  </StrictMode>
)
