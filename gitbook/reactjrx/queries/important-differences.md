# Important Differences

Due to the nature of observables and  reactjrx is based on the React Query API there are some important differences to note.

## `status` and `fetchStatus` do not change together

With a promise, a query gets its data and stops fetching at the same time:

```typescript
const { data, status, fetchStatus } = useQuery({
  queryKey: ["count"],
  queryFn: async () => 2
})

// Renders:
// undefined, "pending", "fetching"
// 2, "success", "idle"
```

An observable can emit before it completes, and its query keeps fetching until it completes. With reactjrx, the query gets its data, and becomes `success`, as soon as the observable emits:

```typescript
const { data, status, fetchStatus } = useQuery$({
  queryKey: ["count"],
  queryFn: () => interval(1000).pipe(take(2))
})

// Renders:
// undefined, "pending", "fetching"
// 0, "success", "fetching"
// 1, "success", "idle"
```

This is the biggest benefit of this library: a long living observable delivers data before its query finishes, if it ever does. It's important to be aware of it and not rely on `data` and `fetchStatus` changing in the same render.

## Query cancellation

A stream is unsubscribed when its fetch is [cancelled](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation): when the last component using the query unmounts, when you call `queryClient.cancelQueries()`, or when the query is removed from the cache. This ensures that no stream runs forever.

```tsx
const MyComponent = () => {
    useQuery$({
        queryKey: [...],
        queryFn: () => NEVER.pipe(
            finalize(() => {
                console.log("This is called when your component unmount")
            })
        )
    })
    
    return null
}
```

The values already received stay in the cache, and the query is marked stale, so it refetches the next time a component needs it.
