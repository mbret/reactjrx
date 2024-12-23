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
import { QueryClient } from "./lib/deprecated/client/QueryClient"
import { MutationCache } from "./lib/deprecated/client/mutations/cache/MutationCache"
import { QueryClientProvider } from "./lib/deprecated/react/QueryClientProvider"
import { finalize, interval } from "rxjs"
import { useMutation$ } from "./lib/queries/useMutation$"

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

  const mutation = useMutation$({
    mutationFn: () =>
      interval(1000).pipe(
        finalize(() => {
          console.log("finalize")
        })
      )
  })
  // const data = useQuery$({
  //   queryKey: ["foo"],
  //   queryFn: () =>
  //     interval(1000).pipe(
  //       // tap(() => {
  //       //   throw new Error("foo")
  //       // })
  //     ),
  //   retry: false
  // })

  console.log({ ...mutation })

  return (
    <>
      <button
        onClick={() => {
          // mySignal.setValue((s) => s + 1)
          mutation.mutate()

          // setTimeout(() => {
          //   mutation.reset()
          // }, 100)
        }}
      >
        mutate
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
