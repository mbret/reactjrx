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
    retryOnError: true, 
    onError: (error) => console.log(error)
  }
);
```

#### Parameters

* `source` : Observable or factory. Your source should be stable if you don't wish to resubscribe at every render.
* `options` (Optional): An object allowing configuration of the subscription behavior. It supports:
  * `retryOnError`: A boolean indicating whether the subscription should automatically retry upon failure. Defaults to `false`.
  * `onError`: A function that is called when an error occurs during subscription. It receives the error as its argument.

#### Return Value

`void`

### **Caveats**&#x20;

* Options will not re-subscribe the source. For example, changing `retryOnError` will just retry the subscription if a new error happens.
