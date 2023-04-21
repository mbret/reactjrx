import React from "react"
import ReactDOM from "react-dom/client"
import { useQuery } from "./lib/queries/useQuery"
import { interval, of, take, timer } from "rxjs"

const s = interval(100).pipe(take(5))

const App = () => {
  console.log(
    "FOOOO",
    useQuery(() => timer(10))
  )

  return null
}

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
