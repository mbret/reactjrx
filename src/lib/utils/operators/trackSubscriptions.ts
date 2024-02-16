import { Observable } from "rxjs"

export function trackSubscriptions(
  onCountUpdate: (activeSubscriptions: number) => void
) {
  let count = 0

  return function refCountOperatorFunction<T>(source: Observable<T>) {
    return new Observable<T>((observer) => {
      count++
      const sub = source.subscribe(observer)
      onCountUpdate(count)

      return () => {
        count--
        sub.unsubscribe()
        onCountUpdate(count)
      }
    })
  }
}
