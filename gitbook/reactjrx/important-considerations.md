---
description: Because nothing is perfect!
---

# Important considerations

## First render of an observable

`useObserve` subscribes to its source while rendering. A source that emits synchronously when subscribed, such as `of(1)`, a `BehaviorSubject` or a `ReplaySubject` holding a value, therefore has its value on the very first render.

A source that emits later, such as a timer or a request, has no value on the first render:

```typescript
const value$ = timer(10)

const MyComponent = () => {
    const { data } = useObserve(value$)

    // data is undefined on the first render, then 0 once the timer fires
}
```

This is expected, and there are two ways to handle it.

### Handle `undefined`

Handle the `undefined` case wherever you use the value: in your JSX, in effects, or when deriving other state.

```typescript
const MyComponent = () => {
    const { data } = useObserve(value$)

    useEffect(() => {
        if (data === undefined) {
            // nothing was emitted yet
        }
    }, [data])
}
```

### Pass a default value

If you know a sensible value before the source emits, pass it as `defaultValue`. The hook returns it until the first emission.

```typescript
const MyComponent = () => {
    const { data } = useObserve(value$, { defaultValue: -1 })

    // data is -1 on the first render, then 0 once the timer fires
}
```
