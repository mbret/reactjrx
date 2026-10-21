---
description: Reactive React.useState()
---

# useObservableState

useState but with a BehaviorSubject as third returned value.

```mts
const [value, setValue, value$] = useObservableState(2)
```

## Reference

```typescript
const MyComponent = () => {
  const [value, setValue, state$] = useObservableState(1);
  
  useSubscribe(() => state$.pipe(
    tap((value) => {
      console.log(value)
    })
  ))

  return (
    <div>
      {value}
    </div>
  );
};
```

***

```typescript
function useObservableState<T>(
    initialValue: T
): [T, Dispatch<SetStateAction<T>>, BehaviorSubject<T>]
```

## Parameters

* `initialValue`: Same as `useState`
