# isDefined

Returns true when the value is neither `null` nor `undefined`.

{% hint style="info" %}
This is a type guard function: it removes `null` and `undefined` from the type, which makes it handy with `filter`.
{% endhint %}

### Usage

```typescript
import { isDefined } from "reactjrx"

const ids = [1, undefined, 3, null].filter(isDefined) // number[]
```

### Reference

```typescript
function isDefined<T>(arg: T | null | undefined): arg is T extends null | undefined ? never : T
```
