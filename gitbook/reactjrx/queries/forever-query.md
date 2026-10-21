---
description: How to deal with never ending observables
---

# Forever Query

Because observable can emit several values before emitting, your query is a bit different than a regular async promise.

Consider this example:

```typescript
const MyComponent = ({ userId }) => {
  const { data: name } = useQuery$({
    queryKey: ["interval"],
    queryFn: () => interval(1000)
  })

  return <div>{name}</div>
}
```

In this situation the query never finish and will emit new data every second.

Internally we handle it by providing a never ending promise to the query and updating the data when the observable emit.

The resulting query will always be in a `fetching` state (as long as the observable does not complete) but in a `success` state as soon as the first value is emitted.

### Queries are never re-executed

By default queries are refetched in different scenario such as network change, components re-mount, etc. In this situation, the query will not be re-executed since it's still in a fetching state. This is usually the expected behavior but it's good to remember it.

### Queries will restart normally

If the observable fail or finish, the query will behave normally following your options (or default options).
