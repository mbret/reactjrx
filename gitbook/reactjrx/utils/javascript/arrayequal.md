# arrayEqual

Returns true when two arrays have the same length and the same items at each index, compared with `===`.

### Usage

```typescript
import { arrayEqual } from "reactjrx"

arrayEqual([1, 2], [1, 2]) // true
arrayEqual([{ id: 1 }], [{ id: 1 }]) // false, the two objects are different references
```

### Reference

```typescript
function arrayEqual<A, B>(a: readonly A[], b: readonly B[]): boolean
```
