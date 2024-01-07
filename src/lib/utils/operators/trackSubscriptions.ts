import { Observable } from "rxjs"

export function trackSubscriptions(
  onCountUpdate: (activeSubscriptions: number) => void
) {
  let count = 0

  return function refCountOperatorFunction<T>(source: Observable<T>) {
    return new Observable<T>((observer) => {
      count++
      onCountUpdate(count)
      const sub = source.subscribe(observer)

      return () => {
        count--
        onCountUpdate(count)
        sub.unsubscribe()
      }
    })
  }
}
