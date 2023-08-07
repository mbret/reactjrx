import {
  type ReactNode,
  createContext,
  memo,
  useContext,
  useMemo,
  useEffect
} from "react"
import { type BehaviorSubject } from "rxjs"
import { useCreateCacheStore } from "./cache/useCreateCacheStore"
import { useQueryStore } from "./deduplication/useQueryStore"
import { createClient } from "./client/createClient"

type CacheStore = Record<string, { value: any; date: number; ttl: number }>

export const Context = createContext<{
  cacheStore: {
    current: BehaviorSubject<CacheStore>
  }
  client: ReturnType<typeof createClient>
}>({
  cacheStore: {} as any,
  client: createClient()
})

export const Provider = memo(
  ({
    children,
    client
  }: {
    children: ReactNode
    client: ReturnType<typeof createClient>
  }) => {
    const cacheStore = useCreateCacheStore()
    const queryStore = useQueryStore()

    const value = useMemo(() => ({ cacheStore, queryStore, client }), [client])

    useEffect(
      () => () => {
        client.destroy()
      },
      [client]
    )

    return <Context.Provider value={value}>{children}</Context.Provider>
  }
)

export const useProvider = () => {
  const context = useContext(Context)

  return { ...context }
}
