---
description: Queries with Streams
---

# About

We provide specific wrappers to be used with [https://tanstack.com/query/latest](https://tanstack.com/query/latest) to support streams as first class queries and mutations.

```typescript
const MyComponent = ({ userId }) => {
  const { data } = useQuery$({
    queryKey: ["network"],
    queryFn: () =>
      merge(
        fromEvent(window, "offline").pipe(map(() => false)),
        fromEvent(window, "online").pipe(map(() => true))
      ),
    initialData: navigator.onLine
  })

  const { mutate } = useMutation$({
    mutationFn: () => fetchAsStream(/** ... */)
  })
 
  return <div>Network status: {data ? "online" : "offline"}</div>
}
```

The API is minimal, uses [https://tanstack.com/query/latest](https://tanstack.com/query/latest) behind the hood and provide a full typing passthrough. They are meant to be used together with other components of the tanstack library.

We use a custom provider under the hood that keeps the observable subscribed and refetch the queries automatically as new values comes in. This makes the wrapper minimal and takes advantage of react-query power.
