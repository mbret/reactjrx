# useQuery$

This hook is similar to [useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery) but takes an observable or an observable factory as queryFn.

```tsx
const MyComponent = ({ userId }) => {
  const { data } = useQuery$({
    queryKey: ["time"],
    queryFn: () => interval(1000)
  })
 
  return <div>{data} seconds elapsed since mounted!</div>
}
```

The query keeps fetching while the observable runs. See [Forever Query](../forever-query.md) for how refetching, invalidation and cancellation work with streams.

For a stream meant to stay open, such as a live database query or a socket, use [useLiveQuery$](uselivequeryusd.md).

## Share options with queryOptions$

`queryOptions$` is TanStack's [queryOptions](https://tanstack.com/query/latest/docs/framework/react/reference/queryOptions) for an observable `queryFn`. It returns the options it is given, with `queryKey` tagged with the query's data type.

```tsx
const pricesQueryOptions = queryOptions$({
  queryKey: ["prices"],
  queryFn: () => webSocket<Price[]>("wss://example.com/prices"),
})

const Prices = () => {
  const { data } = useLiveQuery$(pricesQueryOptions)

  return <PriceList prices={data} />
}

// Price[] | undefined
const prices = queryClient.getQueryData(pricesQueryOptions.queryKey)
```

Pass the result to `useQuery$`, `useLiveQuery$` or `useQueries$`. The `QueryClient` takes its `queryKey`: `getQueryData` returns the query's data type, and `setQueryData` refuses another one.
