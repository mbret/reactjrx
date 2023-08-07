import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { useAsyncQuery } from "./lib/queries/react/useAsyncQuery"

let index = 0

const Effects = () => {
  const { mutate, reset, data } = useAsyncQuery(
    async (arg: string) => {
      index++

      console.log("run", arg)

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve()
        }, 500)
      })

      return arg
    },
    {
      cancelOnUnMount: false,
      onSuccess: (arg) => {
        console.log("mutated", arg)
      }
    }
  )

  console.log({ data })

  useEffect(() => {
    mutate(`mount-${index}`)

    setTimeout(() => {
      reset()
      mutate(`timeout-${index}`)
    }, 499)

    return () => {
      console.log("unmounted")
      reset()
    }
  }, [mutate, reset])

  return null
}

const App = () => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setTimeout(() => {
      setVisible(false)
    }, 10)
  }, [])

  return visible ? <Effects /> : null
}

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
