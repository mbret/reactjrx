import { useEffect } from "react"
import { makeObservable } from "../../utils/makeObservable.ts"
import type { SubscribeSource } from "./types.ts"

export function useSubscribe<T>(source: SubscribeSource<T>) {
  useEffect(() => {
    const sub = makeObservable(source)().subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [source])
}
