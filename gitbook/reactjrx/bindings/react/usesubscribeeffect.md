---
description: Subscribe to your effects in fashion!
---

# useSubscribeEffect

Wrapper to [usesubscribe.md](usesubscribe.md "mention")which gives you some extra control over your observable with react. Such as retry on error, onError callback, etc.

```jsx
useSubscribeEffect(observableOrFactory);
```

## Reference

```typescript
useSubscribeEffect(
  myObservable, 
  {
    retry: 3, 
    onError: (error) => console.log(error)
  }
);
```

#### Parameters

* `source` : Observable or factory. Your source should be stable if you don't wish to resubscribe at every render.
* `options` (Optional): An object allowing configuration of the subscription behavior. It supports:
  * `retry`: Whether to subscribe to the source again after an error. Defaults to `false`.
    * `true`: retry without limit.
    * A number: retry at most that many times in a row. The count goes back to 0 once the source emits again.
    * A function `(attempt, error) => boolean`: retry while it returns `true`. `attempt` is 0 for the first retry.
  * `retryDelay`: Time to wait before each retry, in milliseconds, or a function `(attempt, error) => number`. Defaults to an exponential backoff: 1 s, 2 s, 4 s… up to 30 s. Retries always wait for a timer, so they never run synchronously, even with `0`.
  * `onError`: A function called on every error of the source, including the ones that are retried. It receives the error as its argument.

#### Return Value

`void`

### **Caveats**&#x20;

* Options will not re-subscribe the source. They are read at each error: for example, changing `retry` only applies from the next error.
* An error that is not retried ends the subscription and is reported as an unhandled RxJS error.
