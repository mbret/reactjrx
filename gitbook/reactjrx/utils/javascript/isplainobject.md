# isPlainObject

Returns true if the given value is an object created by the Object constructor.

{% hint style="info" %}
This is a type guard function
{% endhint %}

### Usage

```typescript
import { isPlainObject } from "reactjrx"

const something = { ... }

if (isPlainObject(something)) {
    // object
}
```

### Reference

```typescript
function isPlainObject(value: any): boolean
```
