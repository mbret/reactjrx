# isShallowEqual

Returns true when two values are equal one level deep: primitives compared with `Object.is`, or two objects with the same `constructor` and the same own enumerable string keys holding `Object.is`-equal values. Objects with a null prototype and objects with an own `hasOwnProperty` key are supported. Symbol and non-enumerable properties are not compared.

### Usage

```typescript
import { isShallowEqual } from "reactjrx"

isShallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" }) // true
isShallowEqual({ a: { b: 1 } }, { a: { b: 1 } }) // false, `a` holds two different objects
isShallowEqual({ a: NaN }, { a: NaN }) // true
isShallowEqual(0, -0) // false
```

Pass it as the `compareFn` of [useObserve](../../bindings/react/useobserve.md) to skip the render of a new object that holds the same values.

### Comparison semantics

`NaN` now compares equal to `NaN`, while positive and negative zero compare differently. Previously this helper used `===`, which did the opposite for these cases. If your application treats both zero signs as the same value, normalize them to `0` before comparison or pass a custom `compareFn` with your intended equality rule.

This is a shallow comparison of enumerable properties, not a comparison of built-in object contents. Two `Date` objects with different timestamps or two `Map` or `Set` objects with different entries can compare equal because they have the same constructor and no own enumerable string keys. Use a comparator that checks their contents when those differences matter.

### Reference

```typescript
function isShallowEqual<A, B>(objA: A, objB: B): boolean
```
