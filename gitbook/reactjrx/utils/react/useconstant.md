# useConstant

Creates a value on the first render and returns that same value on every render after it.

### Usage

```tsx
import { useConstant } from "reactjrx"
import { BehaviorSubject } from "rxjs"

const Counter = () => {
  const count$ = useConstant(() => new BehaviorSubject(0))

  // ...
}
```

The value lives in a ref, so it is never recomputed. React can drop a `useMemo` value and compute it again, which would create a second subject.

### Reference

```typescript
function useConstant<T>(fn: () => T): T
```
