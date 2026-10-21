---
description: How to deal with never ending observables
---

# Forever Query

An observable can emit several values, and may never complete. reactjrx runs the whole stream as a single TanStack Query fetch.

Consider this example:

```typescript
const MyComponent = () => {
  const { data } = useQuery$({
    queryKey: ["interval"],
    queryFn: () => interval(1000)
  })

  return <div>{data}</div>
}
```

This query never completes and emits a new value every second:

* Each value is written into the query as soon as the observable emits it, so `queryClient.getQueryData(["interval"])` always returns the latest one.
* The query is `pending` until the first value, then `success`.
* It stays `fetching` (`isFetching` is `true`) until the observable completes, the way a query is fetching until its promise resolves.

### Automatic refetches join the running stream

TanStack refetches queries in several situations: window focus, network reconnection, another component mounting the query, `refetchInterval`. While the stream runs, these join the running fetch: the observable is not subscribed again.

### Explicit refetches restart the stream

`refetch()`, `queryClient.refetchQueries()` and `queryClient.invalidateQueries()` cancel the running fetch, as they do for any query, and run your `queryFn` again. The data stays on screen until the new stream emits.

{% hint style="warning" %}
The promise they return settles when the **new** stream completes. For a stream that never completes, it only settles once that stream is stopped (see below), for example when the last component using the query unmounts. So don't `await` an invalidation that matches a live query, and don't return one from a mutation's `onSuccess` or `onSettled`, or the mutation stays pending. A live query updates itself: it doesn't need invalidating.
{% endhint %}

### Stopping the stream

The observable is unsubscribed when its fetch is cancelled:

* when the last component using the query unmounts,
* with `queryClient.cancelQueries()`,
* when the query is removed from the cache, for example with `queryClient.clear()`.

The values already received stay in the cache, and the query is marked stale, so it refetches the next time a component needs it.

A fetch of a query that no component uses, such as `queryClient.refetchQueries()` on an inactive query, takes the stream's current value and stops: nothing would ever cancel it otherwise.

### Completion and errors

When the observable completes, the query stops fetching and keeps the last value.

If the observable errors, or emits `undefined` (which is not valid query data), the query fails like any fetch: it goes to `error`, keeps its data, and `retry` applies, each retry subscribing again.

`QueryCache`-level `onSuccess` and `onSettled` callbacks run when the fetch completes, like for any query. For a stream that never completes, they never run.
