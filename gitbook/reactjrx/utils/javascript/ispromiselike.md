# isPromiseLike

Assert whether a parameter is a promise like object by checking several parameters. Make sure your objects does not have .then properties if they are not to be promise as it's the minimum requirement of promises as stated in the specs [https://promisesaplus.com/#point-53](https://promisesaplus.com/#point-53). This helper can be useful when you have a library that can take different type of input such as observable, promises or primitive values. It can help you make more flexible function and refine the treatment internally.&#x20;

{% hint style="info" %}
This is a type guard function, the type of your promise will be correctly inferred.
{% endhint %}

### Usage

```typescript
import { isPromiseLike } from "reactjrx"

const maybePromise = Promise.resolve(3)

if (isPromiseLike(maybePromise)) {
    maybePromise.then(value => {
        // typed as `number`
    })
}
```

### Reference

```typescript
function isPromiseLike(value: any): boolean
```
