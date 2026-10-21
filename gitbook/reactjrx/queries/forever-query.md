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

### Refetching a running stream keeps it

`refetch()`, `queryClient.refetchQueries()` and `queryClient.invalidateQueries()` don't restart a stream that is running, since it already keeps the data up to date. They settle right away with its current value, so you can `await` them, or return one from a mutation's `onSuccess`, as with any query.

To restart a stream from scratch, cancel it first, then refetch:

```typescript
await queryClient.cancelQueries({ queryKey: ["interval"] })
await queryClient.refetchQueries({ queryKey: ["interval"] })
```

A refetch that joins the running fetch instead of replacing it, such as `refetch({ cancelRefetch: false })`, waits for the stream to end.

### Stopping the stream

The observable is unsubscribed when its fetch is cancelled:

* when the last component using the query unmounts,
* when no component using the query has it enabled any more (`enabled: false`),
* with `queryClient.cancelQueries()`,
* when the query is removed from the cache, for example with `queryClient.clear()`.

The values already received stay in the cache, and the query is marked stale, so it refetches the next time a component needs it: enabling it again reopens the stream.

As TanStack does with any fetch in progress, disabling a query lets a fetch that waits for the stream's first value finish: the stream stops once it has delivered that value.

A fetch of a query that no component uses, such as `queryClient.refetchQueries()` on an inactive query, takes the stream's first value and stops, and the query is marked stale: nothing would ever cancel the stream otherwise.

### Completion and errors

When the observable completes, the query stops fetching and keeps the last value.

If the observable errors, or emits `undefined` (which is not valid query data), the query fails like any fetch: it goes to `error`, keeps its data, and `retry` applies, each retry subscribing again.

`QueryCache`-level `onSuccess` and `onSettled` callbacks run when a fetch succeeds: once the stream has delivered a value, for the first fetch and each refetch, and again when the stream completes.
