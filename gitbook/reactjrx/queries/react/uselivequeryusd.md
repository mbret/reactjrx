# useLiveQuery$

`useQuery$` for a stream that stays open, such as a live database query or a socket. `useLiveQueries$` does the same for `useQueries$`.

```tsx
const Prices = () => {
  const { data } = useLiveQuery$({
    queryKey: ["prices"],
    queryFn: () => webSocket<Price[]>("wss://example.com/prices"),
  })

  return <PriceList prices={data} />
}
```

It takes the same options as `useQuery$`, except two that it locks:

* `staleTime` is `0`: without a running stream, the data is never fresh.
* `refetchOnMount` is `"always"`: every component that mounts the query fetches it, which joins the running stream or reopens a stopped one.

So a component that needs the query always gets a live stream. With `useQuery$`, a longer `staleTime` or `refetchOnMount: false`, including one set for every query in the `QueryClient`'s `defaultOptions`, would show the last value without reopening the stream.

To wrap it in a hook of your own, type its options with `UseLiveQuery$Options`, which leaves both out.

Everything else works as with `useQuery$`, as described in [Forever Query](../forever-query.md): the query stays fetching while the stream runs, automatic refetches join the stream, `refetch()` and invalidation restart it, and it stops when no component uses the query any more.

As for any query, with the default `networkMode` (`"online"`), a fetch started offline waits for the network before it runs. For a source that doesn't need the network, such as a local database, set `networkMode: "always"` so its stream opens offline too.
