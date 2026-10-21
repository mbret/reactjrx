# useObserve

The `useObserve` hook subscribes to an observable and returns its latest value, along with the state of the stream. It is the building block of higher order hooks such as the ones used in [Queries](https://app.gitbook.com/s/uE1Z7PHuhXh0NunQ33Mr/queries "mention").&#x20;

```typescript
useObserve(source, optionsOrDeps?, deps?)
```

## Reference

```typescript
function App () {
    const { data: user } = useObserve(user$)

    return <div>current user: { user?.name }</div>
}
```

***

```typescript
function useObserve<T, DefaultValue>(
  source: Observable<T> | (() => Observable<T> | undefined) | undefined,
  optionsOrDeps?: Options<T, DefaultValue> | DependencyList,
  deps?: DependencyList
): {
  data: T | DefaultValue
  status: "pending" | "success" | "error"
  observableState: "live" | "complete" | "error"
  error: unknown
}
```

```typescript
interface Options<T, DefaultValue> {
  defaultValue?: DefaultValue
  compareFn?: (a: T, b: T) => boolean
}
```

### Parameters

* `source`: An observable, a function returning one, or `undefined`. Pass a stable observable directly: the hook subscribes to it again when its reference changes. Otherwise pass a function with `deps`, so the observable is only created again when a dependency changes. With `undefined`, nothing is observed and the default value is returned.
* **optional** `options`:
  * `defaultValue`: returned until the source emits its first value. A `BehaviorSubject`, or any source that emits synchronously when subscribed, doesn't need it: its value is there on the first render.
  * `compareFn`: tells whether a new value equals the previous one. An equal value doesn't re-render. Defaults to strict equality (`===`). Pass `isShallowEqual` (exported by reactjrx), or your own function, to compare objects by content.
* **optional** `deps`: The values the function depends on. When one of them changes (compared with [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)), the function is called again and its observable replaces the previous one.

### Returns

An object with:

* `data`: the latest value. Before the first emission, it's the `BehaviorSubject`'s value or `defaultValue` (`undefined` otherwise).
* `status`: `"pending"` while the source is live, `"success"` once it completes, `"error"` once it errors.
* `observableState`: `"live"`, `"complete"` or `"error"`.
* `error`: the error the source failed with, when `status` is `"error"`.

### **Caveats**&#x20;

* The hook subscribes while rendering, so a source that emits synchronously (`of(x)`, a `BehaviorSubject`, a `ReplaySubject` holding a value) has its value on the first render. A source that emits later returns the default value until it does.
* A new value that `compareFn` considers equal to the previous one doesn't re-render. By default that's strict equality, so a new object with the same content does re-render.
* An error doesn't throw: the hook returns `status: "error"` with the `error`, keeps the last `data`, and doesn't report the error as unhandled.
* Once the source has completed or errored, the hook doesn't subscribe to it again. Pass a new source, or change `deps`, to start over.

## Usages

#### Displaying a timer

Here we display an infinite timer which starts at `0`. The timer can't emit on the first render, so `defaultValue` provides a value until it does. The `map` makes `1` the first value the source emits.

```typescript
function App () {
    const { data: currentTime } = useObserve(
      () => interval(1000).pipe(map((value) => value + 1)),
      { defaultValue: 0 },
      []
    )

    return <div>{ currentTime }</div>
}
```

#### Subscribing to an external subject

A `BehaviorSubject` always holds a value, so it's there on the first render.

```typescript
const clickedSubject = new BehaviorSubject(0)

function App () {
    const { data: clicked } = useObserve(clickedSubject)

    return (
        <div>
            <div>User clicked { clicked } times</div>
            <button onClick={() => clickedSubject.next(clicked + 1)}>click me!</button>
        </div>
    )
}
```

Any source that emits synchronously when subscribed, such as a `ReplaySubject` that already holds a value, is there on the first render too. Its type doesn't say so, though, so handle `undefined` or pass a `defaultValue`:

```typescript
const clickedSubject = new ReplaySubject<number>(1)

function App () {
    const { data: clicked } = useObserve(clickedSubject)

    if (clicked === undefined) return null

    return (
        <div>
            <div>User clicked { clicked } times</div>
            <button onClick={() => clickedSubject.next(clicked + 1)}>click me!</button>
        </div>
    )
}
```

#### Selecting part of a value

There is no selector option: map the source to the part you need, and skip values whose selected part didn't change with `distinctUntilChanged`.

```typescript
const value$ = new BehaviorSubject({ foo: "bar", bar: "foo" })

// in your component
const { data: foo } = useObserve(
  () =>
    value$.pipe(
      map(({ foo }) => foo),
      distinctUntilChanged()
    ),
  []
)
```
