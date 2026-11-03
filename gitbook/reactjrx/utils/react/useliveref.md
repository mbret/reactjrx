# useLiveRef

Returns a ref that holds the value of the last committed render. A callback or a subscription that outlives the render reads the current value from it, without listing that value as a dependency.

The ref updates in a layout effect, after commit. So a render that React drops, such as a suspended transition, never changes it. During render, the ref still holds the previous committed value: give code that runs during render the value itself.

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
