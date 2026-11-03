# isShallowEqual

Returns true when two values are equal one level deep: the same primitive, or two objects with the same prototype and the same own keys holding `===` values.

### Usage

```typescript
import { isShallowEqual } from "reactjrx"

isShallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" }) // true
isShallowEqual({ a: { b: 1 } }, { a: { b: 1 } }) // false, `a` holds two different objects
```

Pass it as the `compareFn` of [useObserve](../../bindings/react/useobserve.md) to skip the render of a new object that holds the same values.

### Reference

```typescript
function isShallowEqual<A, B>(objA: A, objB: B): boolean
```
