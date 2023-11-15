import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "."

const App = () => {
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
