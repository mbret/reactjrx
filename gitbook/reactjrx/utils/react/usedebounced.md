# useDebounced

Returns a function that runs `func` when the calls stop for `wait` ms. Each call restarts the delay, and only the last call runs, with its argument.

### Usage

```tsx
import { useDebounced } from "reactjrx"

const Search = ({ onSearch }: { onSearch: (text: string) => void }) => {
  const search = useDebounced(onSearch, 300)

  return <input onChange={(event) => search(event.target.value)} />
}
```

When the delay ends, the call runs the latest `func`. So a new `onSearch` from a later render applies to a pending call. The returned function changes only when `wait` changes.

If the component unmounts, a pending call does not run. Pass `cancelOnUnmount: false` to run it after the unmount.

### Reference

```typescript
function useDebounced<T>(
  func: ((arg: T) => void) | (() => void),
  wait: number,
  options?: { cancelOnUnmount?: boolean },
): (arg: T) => void
```
