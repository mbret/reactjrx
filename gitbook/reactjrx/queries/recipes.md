# Recipes

## Queuing and buffering mutation calls

This recipe let you queue subsequent mutation calls until the current mutation is done. Additionally, it will buffer mutations calls to only trigger once. It is equivalent to a `concatMap` with buffering.

<pre class="language-tsx"><code class="lang-tsx">import { useMutation$, useObservableCallback, useSubscribe } from "reactjrx"

export const MyComp = () => {
    const [mutate$, mutate] = useObservableCallback()
    
    const { mutateAsync } = useMutation$({
        mutationFn: () => longRunningObservable()
    })
    
    useSubscribe(
        () =>
            // triggers will be throttled (therefore skipped)
            // until the current mutation is done.
            // We keep trailing to empty the queue.
            mutate$.pipe(
                throttle(() => from(mutateAsync().catch(noop)), { trailing: true })
            ),
        [mutateAsync, mutate$]
    )
  
    // mutate when needed
<strong>    useEffect(() => {
</strong>        mutate()
    }, [mutate, /** ... */])
}



</code></pre>

