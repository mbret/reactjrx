import { useEffect } from "react"
import { makeObservable } from "../../utils/makeObservable"
import type { SubscribeSource } from "./types"

export function useSubscribe<T>(source: SubscribeSource<T>) {
  useEffect(() => {
    const sub = makeObservable(source)().subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [source])
}
