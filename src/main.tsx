import React from "react"
import ReactDOM from "react-dom/client"
import { interval, map, tap } from "rxjs"
import { useObserve } from "./lib/binding/useObserve"
import { useSubscribe } from "./lib/binding/useSubscribe"

const App = () => {
  useObserve(() => interval(1000), [])
  useSubscribe(
    () =>
      interval(300).pipe(
        map((v) => {
          if (v > 1) {
            throw new Error("")
          }
          return v
        }),
        tap(console.log)
      ),
    []
  )

  return null
}

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
