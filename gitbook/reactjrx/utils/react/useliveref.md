# useLiveRef

Returns a ref that holds the value passed on the latest render. A callback or a subscription that outlives the render reads the current value from it, without listing that value as a dependency.

### Usage

```tsx
import { useEffect } from "react"
import { useLiveRef } from "reactjrx"

const MessageLogger = ({ onMessage }: { onMessage: (message: string) => void }) => {
  const onMessageRef = useLiveRef(onMessage)

  useEffect(() => {
    const subscription = messages$.subscribe((message) => onMessageRef.current(message))

    return () => subscription.unsubscribe()
  }, [onMessageRef])

  return null
}
```

The subscription stays open across renders and calls the latest `onMessage`, so a new callback doesn't resubscribe.

### Reference

```typescript
function useLiveRef<T>(value: T): RefObject<T>
```
