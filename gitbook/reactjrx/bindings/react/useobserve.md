# useObserve

The `useObserve` hook subscribe to an observable and return the latest value. This hook is the building block of higher order hooks such as the ones used in [Queries](https://app.gitbook.com/s/uE1Z7PHuhXh0NunQ33Mr/queries "mention").&#x20;

```typescript
useObserve(source, optionsOrDeps?, deps?)
```

## Reference

```typescript
function App () {
    const user = useObserve(user$)
    
    return <div>current user: { user?.name }</div>
}
```

***

```typescript
function useObserve<T>(
  source: Observable<T> | (() => Observable<T>),
  optionsOrDeps?: Option<T> | DependencyList,
  deps?: DependencyList
): T
```

```typescript
interface Option<R = undefined> {
  defaultValue: R
  unsubscribeOnUnmount?: boolean
}
```

### Parameters

* `source` : Observable or a function returning an observable. If you have a stable reference to an observable you can pass it directly, otherwise you should use the factory function to avoid unwanted re-render. Deps can be used to optimise re-render further.
* **optional** `options` : options lets you define a default value to use and control the subscription on unmount. By default the observable will be unsubscribed on unmount. `defaultValue` can be used to prevent returning `undefined` until your observable emit its first value. You don't need `defaultValue` with `BehaviorSubject`
* **optional** `deps` : The list of all reactive values referenced inside of the `fn` code. Reactive values include props, state, and all the variables and functions declared directly inside your component body. The list of dependencies must have a constant number of items and be written inline like `[dep1, dep2, dep3]`. React will compare each dependency with its previous value using the [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) comparison algorithm.

### Returns

Will return `undefined` until a value is provided to your observable. If you are using a `BehaviorSubject` or `defaultValue` option, it will return this value first. There is a shallow comparison internally which will prevent re-render if a new value is equal to the previous one.

### **Caveats**&#x20;

* Due to the nature of observable the first value will be undefined until the hook can subscribe to the source. Once the subscription done and if a value is emitted a new render will occurs. You can use a `BehaviorSubject` or `defaultValue` to mitigate it. We will bring support to Suspense in the future.
* Due to internal optimization if your observable emit a new value, it will not re-render if the value is shallow equal to the previous one.
* The hook will log and swallow any error caught. You should handle it on your side if needed.

## Usages

#### Displaying a timer

Here we display an infinite timer which start at `0`. We take advantage of `defaultValue` since our observable cannot emit a value synchronously on first render. The map make sure to have `1` instead of `0` as first emitted value from the source.

```typescript
function App () {
    const currentTime = useObserve(
      () => {
        return interval(1000).pipe(map((value) => value + 1))
      },
      { defaultValue: 0 },
      []
    )
    
    return <div>{ currentTime }</div>
}
```

#### Subscribing to an external subject

Because our subject is a `BehaviorSubject` we can get the right value from the first render.

<pre class="language-typescript"><code class="lang-typescript"><strong>const clickedSubject = new BehaviorSubject(0)
</strong><strong>
</strong><strong>function App () {
</strong>    const clicked = useObserve(clickedSubject)
    
    return (
        &#x3C;div>
            &#x3C;div>User clicked { clicked } times&#x3C;/div>
            &#x3C;button onClick={() => clickedSubject.next(clicked + 1) }>click me!&#x3C;/button>
        &#x3C;/div>
    )
}
</code></pre>

In a situation where you cannot have a `BehaviorSubject` but you know your observable will emit a value as soon as being subscribed you can either check for undefined or use a different defaultValue to handle the situation.

<pre class="language-typescript"><code class="lang-typescript"><strong>const clickedSubject = new ReplaySubject(1)
</strong><strong>
</strong><strong>function App () {
</strong>    const clicked = useObserve(clickedSubject)
    
    if (clicked === undefined) return null
    
    return (
        &#x3C;div>
            &#x3C;div>User clicked { clicked } times&#x3C;/div>
            &#x3C;button onClick={() => clickedSubject.next(clicked + 1) }>click me!&#x3C;/button>
        &#x3C;/div>
    )
}
</code></pre>

This limitation is due to the fact the hook will subscribe to the observable after the first render. If you know your observable emit a value on subscription you don't need a skeleton or loading state since it will be re-rendered immediately. You can return null or deal with undefined object access and it will be virtually impossible for the user to see it.

### Selector

You can use the selector option to observe only a subset of your object. This will also use a shallow comparison by default to prevent unnecessary re-render since we are not. just subscribing to the observable raw value.

When using a factory, selectors are not available. It would conflict with the function signature expecting DependencyList. In this situation you are best suited to customize your returned observable anyway.

```typescript
const value$ = new BehaviorSubject({ foo: "bar", bar: "foo" })

// in your component
const { foo } = useObserve(value$, ["foo"]) // -> Return type is { foo: string }
```
