import { useCallback, useContext } from "react"
import { Context } from "./Provider"
import { Observable, tap } from "rxjs"

export const useCacheOperator = () => {
  const { cacheStore } = useContext(Context) ?? {}

  return useCallback(
    <T>(key: any[]) => {
      const serializedKey = JSON.stringify(key)

      return (source: Observable<T>) => {
        return new Observable<T>((subscriber) => {
          const store = cacheStore?.current.getValue() ?? {}
          const existingValue = store[serializedKey]

          console.log(
            `[cache] Checking cache for ${serializedKey}`,
            existingValue
          )

          if (existingValue) {
            console.log(`[cache] using cache value for ${serializedKey}`)
            subscriber.next(existingValue.value)
            subscriber.complete()

            return
          }

          const sub = source
            .pipe(
              tap((value) => {
                if (cacheStore?.current) {
                  console.log(
                    `[cache] update cache for ${serializedKey}`,
                    value
                  )

                  cacheStore.current.next({
                    ...cacheStore.current.getValue(),
                    [serializedKey]: {
                      value,
                      date: new Date().getTime(),
                      ttl: 5000
                    }
                  })
                }
              })
            )
            .subscribe(subscriber)

          return () => sub.unsubscribe()
        })
      }
    },
    [cacheStore]
  )
}
