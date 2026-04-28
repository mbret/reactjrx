import {
  MutationCache as RQMutationCache,
  QueryClient as rc_QueryClient,
} from "@tanstack/react-query"
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { memo, StrictMode, useState } from "react"
import ReactDOM from "react-dom/client"
import { interval } from "rxjs"
import { QueryClientProvider$ } from "./lib/queries/QueryClientProvider$"
import { useQuery$ } from "./lib/queries/useQuery$"
import { SignalContextProvider } from "./lib/state/react/SignalContextProvider"
import { useSignal } from "./lib/state/react/useSignal"
import { signal, virtualSignal } from "./lib/state/Signal"

const PERSIST_KEY = "reactjrx-dev-query-cache"

const localStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(client))
  },
  restoreClient: async () => {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return undefined
    return JSON.parse(raw) as PersistedClient
  },
  removeClient: async () => {
    localStorage.removeItem(PERSIST_KEY)
  },
}

const rcClient = new rc_QueryClient({
  mutationCache: new RQMutationCache({
    onError: (error) => {
      console.log("cache onError", error)
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: 0,
    },
  },
})

const alternateSignal = signal<{ foo: "foo" } | { bar: number }>({
  default: { foo: "foo" },
})

alternateSignal.update((state) => ({
  ...state,
  foo: "foo" as const,
}))

const virtualSignal1 = virtualSignal({
  key: "foo",
  default: { foo: 2 },
})

const SubCom = memo(() => {
  const [bar, setBar] = useSignal(virtualSignal1)

  console.log({ bar: bar.foo })

  return (
    <div>
      <button
        type="button"
        onClick={() => setBar((bar) => ({ ...bar, foo: bar.foo + 1 }))}
      >
        tap
      </button>
    </div>
  )
})

const QueryInterval = memo(() => {
  const {
    data: data$,
    status,
    fetchStatus,
  } = useQuery$({ queryFn: () => interval(1000), queryKey: ["test"] })
  console.log({ data$, status, fetchStatus })

  return null
})

const App = memo(() => {
  const [isVisible, setIsVisible] = useState(true)
  const [isVisible2, setIsVisible2] = useState(true)

  return (
    <>
      <button type="button" onClick={() => setIsVisible(!isVisible)}>
        Toggle 1
      </button>
      <button type="button" onClick={() => setIsVisible2(!isVisible2)}>
        Toggle 2
      </button>
      {isVisible && <QueryInterval />}
      {isVisible2 && <QueryInterval />}
      <button type="button" onClick={() => rcClient.clear()}>
        Clear rc client
      </button>
      {isVisible && (
        <SignalContextProvider>
          <SubCom />
        </SignalContextProvider>
      )}
    </>
  )
})

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={rcClient}
      persistOptions={{
        persister: localStoragePersister,
        maxAge: 1000 * 60 * 60 * 24,
      }}
    >
      <QueryClientProvider$>
        <SignalContextProvider>
          <App />
        </SignalContextProvider>
      </QueryClientProvider$>
    </PersistQueryClientProvider>
  </StrictMode>,
)
