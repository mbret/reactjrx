import { interval, skip, tap, withLatestFrom } from "rxjs"
import { useBehaviorSubject } from "../../binding/useBehaviorSubject"
import { useSubscribe } from "../../binding/useSubscribe"

type CacheStore = Record<string, { value: any; date: number; ttl: number }>

export const useCreateCacheStore = () => {
  const cacheStore = useBehaviorSubject<CacheStore>({})

  useSubscribe(
    () =>
      cacheStore.current.pipe(
        skip(1),
        tap(() => {
          const store = cacheStore.current.getValue()
          console.log(
            "[cache] update",
            Object.keys(store).reduce((acc, key) => {
              const entry = store[key]

              if (entry) {
                acc[key] = entry
              }

              // @ts-ignore
              acc[key]._debug = {
                // @ts-ignore
                eol: new Date(store[key].date + store[key].ttl)
              }

              return acc
            }, {} as CacheStore)
          )
        })
      ),
    [cacheStore]
  )

  useSubscribe(
    () =>
      interval(1000).pipe(
        withLatestFrom(cacheStore.current),
        tap(() => {
          // console.log("cleanup pass")

          const now = new Date().getTime()

          const store = cacheStore.current.getValue()
          const keys = Object.keys(store)
          const validKeys = keys.filter((key) => {
            const value = store[key]

            if (value && value.date + value.ttl > now) {
              return true
            }

            return false
          })

          if (validKeys.length === keys.length) {
            return
          }

          const newStore = validKeys.reduce((acc, key) => {
            const entry = store[key]

            if (entry) {
              acc[key] = entry
            }

            return acc
          }, {} as CacheStore)

          cacheStore.current.next(newStore)
        })
      ),
    [cacheStore]
  )

  return cacheStore
}
