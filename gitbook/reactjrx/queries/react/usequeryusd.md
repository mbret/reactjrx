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
