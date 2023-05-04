import { type ReactNode, createContext, memo, useContext, useMemo } from 'react'
import { type BehaviorSubject } from 'rxjs'
import { useCreateCacheStore } from './cache/useCreateCacheStore'
import { useQueryStore } from './deduplication/useQueryStore'

type CacheStore = Record<string, { value: any, date: number, ttl: number }>

export const Context = createContext<
| undefined
| {
  cacheStore: {
    current: BehaviorSubject<CacheStore>
  }
  queryStore: ReturnType<typeof useQueryStore>
}
>(undefined)

export const Provider = memo(({ children }: { children: ReactNode }) => {
  const cacheStore = useCreateCacheStore()
  const queryStore = useQueryStore()

  const value = useMemo(() => ({ cacheStore, queryStore }), [])

  return <Context.Provider value={value}>{children}</Context.Provider>
})

export const useProvider = () => {
  const context = useContext(Context)

  return { ...context }
}
