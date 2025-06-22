import {
  QueryClientProvider as RcQueryClientProvider,
  MutationCache as RQMutationCache,
  QueryClient as rc_QueryClient,
} from "@tanstack/react-query"
import { memo, StrictMode, useState } from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider$ } from "./lib/queries/QueryClientProvider$"
import { SignalContextProvider } from "./lib/state/react/SignalContextProvider"
import { useSignal } from "./lib/state/react/useSignal"
import { virtualSignal } from "./lib/state/Signal"

const rcClient = new rc_QueryClient({
  mutationCache: new RQMutationCache({
    onError: (error) => {
      console.log("cache onError", error)
    },
  }),
})

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

const App = memo(() => {
  const [isVisible, setIsVisible] = useState(true)

  return (
    <>
      <button type="button" onClick={() => setIsVisible(!isVisible)}>
        Toggle
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
    <RcQueryClientProvider client={rcClient}>
      <QueryClientProvider$>
        <SignalContextProvider>
          <App />
        </SignalContextProvider>
      </QueryClientProvider$>
    </RcQueryClientProvider>
  </StrictMode>,
)
