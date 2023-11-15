import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider, signal, useSignalValue } from "."

const myState = signal({
  key: "myState",
  default: 2
})

const App = () => {
  console.log(useSignalValue(myState))

  return null
}

const client = new QueryClient()

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
