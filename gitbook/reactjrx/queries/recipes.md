# Recipes

## Queuing and buffering mutation calls

This recipe let you queue subsequent mutation calls until the current mutation is done. Additionally, it will buffer mutations calls to only trigger once. It is equivalent to a `concatMap` with buffering.

```tsx
import { useCallback, useEffect } from "react"
import { useConstant, useMutation$, useSubscribe } from "reactjrx"
import { from, noop, Subject, throttle } from "rxjs"

export const MyComp = () => {
    // a stream of mutation requests
    const mutate$ = useConstant(() => new Subject<void>())

    const { mutateAsync } = useMutation$({
        mutationFn: () => longRunningObservable()
    })

    const queueMutations = useCallback(
        () =>
            // triggers will be throttled (therefore skipped)
            // until the current mutation is done.
            // We keep trailing to empty the queue.
            mutate$.pipe(
                throttle(() => from(mutateAsync().catch(noop)), { trailing: true })
            ),
        [mutateAsync, mutate$]
    )

    useSubscribe(queueMutations)

    // mutate when needed
    useEffect(() => {
        mutate$.next()
    }, [mutate$, /** ... */])
}
```

