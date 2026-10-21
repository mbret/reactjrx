---
description: >-
  Start by wrapping your app with our Provider. The provider needs to be under
  QueryClientProvider.
---

# Getting Started

```tsx
import { QueryClientProvider$ } from "reactjrx"

export const Main = () => {
    return (
      <StrictMode>
        <QueryClientProvider client={client}>
          <QueryClientProvider$>
            <App />
          </QueryClientProvider$>
        </QueryClientProvider>
      </StrictMode>
    )
}
```

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
