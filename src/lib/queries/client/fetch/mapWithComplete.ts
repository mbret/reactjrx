import {
  map,
  type OperatorFunction,
} from "rxjs"

export const mapWithComplete =
  <T, R>(
    mapFn: ({ isComplete }: { isComplete: boolean }) => (data: T) => R
  ): OperatorFunction<T, R> =>
  (stream) => {
    // const s = stream.pipe(shareReplay({ refCount: true, bufferSize: 1 }))

    return stream.pipe(map(mapFn({ isComplete: false })))

    // return race(
    //   s.pipe(
    //     last(),
    //     tap({
    //       next: () => {
    //         console.log("LAST NEXT")
    //       },
    //       complete: () => {
    //         console.log("LAST COMPLETE")
    //       }
    //     }),
    //     map(mapFn({ isComplete: true }))
    //   ),
    //   s.pipe(
    //     delay(10),
    //     tap({
    //       next: () => {
    //         console.log("NEXT")
    //       },
    //       complete: () => {
    //         console.log("COMPLETE")
    //       }
    //     }),
    //     map(mapFn({ isComplete: false }))
    //   )
    // )
  }
