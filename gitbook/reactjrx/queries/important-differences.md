# Important Differences

Due to the nature of observables and  reactjrx is based on the React Query API there are some important differences to note.

## Delayed `success` fetchStatus

After a successful query, the query return its data and a `success` fetchStatus. Normally you would expect the status to be updated at the same time as the result. Something like that:

```typescript
const { data, fetchStatus } = useQuery({ queryFn: () => 2 })

console.log(data, fetchStatus)

Renders:
// undefined, "loading"
// 2, "success"
```

However, because observables return data first and then later complete we cannot know if a request is a success until its observable completes. The biggest benefit of this library is to be able to have long living observable as a query, which means you can receive data before a query succeed (if ever). This is not a bug but it's important to be aware of this behavior and not rely of the synchronisation of `data` and fetchStatus per render.

This is how it looks with reactjrx:

```typescript
const { data, fetchStatus } = useQuery({ queryFn: () => 2 })

console.log(data, fetchStatus)

Renders:
// undefined, "loading"
// 2, "loading"
// 2, "success"
```

## Query cancellation

By default, stream queries will be unsubscribed to when there are no more [query observers](https://tanstack.com/query/latest/docs/reference/QueryObserver). This ensure that no queries run forever.

When a stream is not completed when unsubscribed, the query will be [cancelled](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation#manual-cancellation). Similar to how you would manually cancel your query.

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
