import { type Observable, defer, finalize } from 'rxjs'

export function trackSubscriptions (
  onCountUpdate: (activeSubscriptions: number) => void
) {
  return function refCountOperatorFunction<T> (source$: Observable<T>) {
    let counter = 0

    return defer(() => {
      counter++
      onCountUpdate(counter)
      return source$
    }).pipe(
      finalize(() => {
        counter--
        onCountUpdate(counter)
      })
    )
  }
}
