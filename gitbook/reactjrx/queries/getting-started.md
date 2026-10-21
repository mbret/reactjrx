---
description: >-
  Queries run on TanStack Query: wrap your app with its QueryClientProvider and
  you're ready.
---

# Getting Started

Queries need [TanStack Query](https://tanstack.com/query/latest) 5.85.1 or later. Wrap your app with its `QueryClientProvider`, as for any TanStack query.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const client = new QueryClient()

export const Main = () => {
    return (
      <StrictMode>
        <QueryClientProvider client={client}>
          <App />
        </QueryClientProvider>
      </StrictMode>
    )
}
```

{% hint style="info" %}
Earlier versions of reactjrx also needed a `QueryClientProvider$` wrapper. It no longer exists: remove it.
{% endhint %}

You can then start using our custom hooks.

```tsx
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
