---
description: Because nothing is perfect!
---

# Important considerations

## First render of an observable

`useObserve` subscribes once React has committed the render, never while rendering. On the first render, and after a deps change, only a source that holds a value has it: a `BehaviorSubject`, or a signal. Any other source returns `status: "pending"` and its default value.

A source that emits as soon as it is subscribed, such as `of(1)`, a piped signal or a `ReplaySubject` holding a value, has its value right after mount, in a second render. A source that emits later, such as a timer or a request, stays pending until it does:

```typescript
const value$ = timer(10)

const MyComponent = () => {
    const { data, status } = useObserve(value$)

    // status is "pending" and data is undefined on the first render,
    // then "success" and 0 once the timer fires
}
```

This is expected, and there are three ways to handle it.

### Check `status`

Render something else until the source has a value. Once `status` is `"success"`, `data` is typed as a value.

```typescript
const MyComponent = () => {
    const { data, status } = useObserve(value$)

    if (status !== "success") return <Spinner />

    return <div>{data}</div>
}
```

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

If you know a sensible value before the source emits, pass it as `defaultValue`. The hook returns it while the source is pending.

```typescript
const MyComponent = () => {
    const { data } = useObserve(value$, { defaultValue: -1 })

    // data is -1 on the first render, then 0 once the timer fires
}
```
