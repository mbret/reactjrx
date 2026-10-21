---
description: How to deal with never ending observables
---

# Forever Query

An observable can emit several values, and may never complete. reactjrx keeps such a query fetching for as long as its stream runs.

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

### Keep the default `staleTime`

A running stream keeps its query up to date, and automatic refetches join it, so a longer `staleTime` saves nothing for a live query. It can even keep the stream from opening: data that a running stream doesn't back, such as `initialData`, a cache restored from storage, or the last value of a stream that stopped when its component unmounted, then counts as fresh, so the query doesn't fetch and its stream doesn't start.

### Explicit refetches restart the stream

As for any query, `refetch()`, `queryClient.refetchQueries()`, `queryClient.invalidateQueries()` and `queryClient.resetQueries()` cancel the fetch in progress and run the `queryFn` again: the running stream stops and a new one starts. The data stays until the new stream emits, except after `resetQueries()`, which first puts the query back in its initial state.

They settle with the new stream's first value, so you can `await` them, or return one from a mutation's `onSuccess`, as with any query. A stream that emits its current value when subscribed, such as a `BehaviorSubject` or most live database queries, settles them right away. A stream that only emits on events settles them at its next event.

Before the stream's first value, `refetch()`, `queryClient.refetchQueries()` and `queryClient.invalidateQueries()` join the fetch in progress instead, as TanStack does for any query that has no data yet: the stream keeps running, and they settle with its first value. `queryClient.resetQueries()` still restarts it.

A refetch that joins the running fetch instead of replacing it, such as `refetch({ cancelRefetch: false })`, keeps the stream and waits for it to end.

### Stopping the stream

The observable is unsubscribed when its fetch is cancelled:

* when the last component using the query unmounts,
* when no component using the query has it enabled any more (`enabled: false`),
* with `queryClient.cancelQueries()`,
* when the query is removed from the cache, for example with `queryClient.clear()`.

The values already received stay in the cache. As for any query, `staleTime` decides when it refetches, which reopens the stream: with the default, the next time a component needs it, for example when it mounts again or is enabled again.

As TanStack does with any fetch in progress, disabling a query lets a fetch that waits for the stream's first value finish: the stream stops once it has delivered that value.

A fetch of a query that no component uses, such as `queryClient.refetchQueries()` on an inactive query, takes the stream's first value and stops: nothing would ever cancel the stream otherwise.

### Completion and errors

When the observable completes, the query stops fetching and keeps the last value.

If the observable errors, or emits `undefined` (which is not valid query data), the query fails like any fetch: it goes to `error`, keeps its data, and `retry` applies, each retry subscribing again.

`QueryCache`-level `onSuccess` and `onSettled` callbacks run when a fetch succeeds: once the stream has delivered a value, for the first fetch and each refetch, and again when the stream completes.
