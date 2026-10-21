---
description: Because nothing is perfect!
---

# Important considerations

## Asynchronous nature of observables

Because of the nature of observable, getting a value out of them (subscribing) is asynchronous. Except for `behaviorSubject` which can be accessed statically, subscribing to an observable will yield a result asynchronously. It is obvious with an observable like this `timer(10)` but this is also the case for something like this `of(1).`

In the context of react it means that you cannot do something like this:

```typescript
const value$ = of(1)

const MyComponent = () => {
    const value = useObserve(value$)
    
    // value will be 1 on mount --> FALSE
    
    console.log(value)
    
    // yield undefined on first render
    // yield 1 on subsequent renders
}
```

This is a consideration but not an actual problem as it is expected.&#x20;

You have several options to handle it:

### Handle `undefined`

If it's possible you just need to handle the `undefined` case. Wheter you use it in your jsx, effects or to derive other states, as long as you handle `undefined` you are good to go.

```typescript
const value$ = of(1)

const MyComponent = () => {
    const value = useObserve(value$)
    
    useEffect(() => {
        if (value === undefined) {
            // handle the case
        }
    }, [value])
}
```

### Use default value when possible to mitigate

Some hooks such as `useObserve` allow you to pass a default value so that you can avoid the first render yielding `undefined.` If you happen to know the value statically beforehand you can mitigate the issue.

```typescript
const value$ = new BehaviorSubject(1)

const MyComponent = () => {
    const value = useObserve(value$, { defaultValue: value.getValue() })
    
    // rest
}
```

However useObserve has some internal optimisation and will already return the value at first render if you pass a behaviorSubject

```typescript
const value$ = new BehaviorSubject(1)

const MyComponent = () => {
    const value = useObserve(value$)
    
    // will yield 1 on first render, useObserve infer the fact that value$
    // is a BehaviorSubject
}
```

Of course, you cannot always have a `BehaviorSubject.` but it's still convenient to remember that.

### Use suspense

The new suspense API is dedicated to solve these kind of issues. It helps you defer the first render until some things are done. In this case you can use specific version of hooks to take advantage of suspense. Hooks that yield a value usually have a suspense counterpart that you can use:

```typescript
const value$ = of(1)

const MyComponent = () => {
    const value = useObserveSuspense(value$)
    
    // will yield 1 on first render
}
```

{% hint style="warning" %}
Remember that subscribing to the first value of an observable (if they yield a value instantly) just take one tick. The user will not see a blank page or loading screen. It is really just a matter of subscribing and then emiting the value in the next tick. If you use suspense, you do not need to worry about creating a loading state for that matter.
{% endhint %}
