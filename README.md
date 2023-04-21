# reactjrx

`reactjrx` is a javascript library which provides a simple and efficient API for handling global state, flow control, and queries in React applications using RxJS. With a small footprint and scalability to suit any project size, it is a great alternative to other popular libraries such as Recoil, Redux, React Query, Zustand, etc.

There are two layers to this library, a lower level of pure binding between rxjs and react and a higher level layer to solve the state, flow and queries problems.

# Installation

To install Reactjrx, simply run:

```
npm install reactjrx
```

# Overview

## Low level API: RxJS bindings

The low level API is basically all the building blocks to bind rxjs to react. For example let's assume
you have a library that expose observables, you can bind them easily:

```typescript
const interval$ = interval(100)

const App = () => {
  // observe the returned value of an observable
  const counter = useObserve(interval$)

  // subscribe to an observable. Similar to observe but
  // does not sync nor return the observable output with react.
  useSubscribe(
    () =>
      interval$.pipe(
        tap((value) => {
          console.log("counter", value)
        })
      ),
    []
  )

  return <>Counter {counter}</>
}
```

You may also want to use rxjs intentionally with react to have greater flow control.
These two bindings are the main building block but we provide more utils to help you:

```typescript
/**
 * useObserveCallback is a version of useCallback which use useSubscribe
 * internally to provide a convenient flow control.
 * In this scenario we have a callback which sync user settings
 * but also:
 * - Cancel any previous request when the user start a new one together
 * - Retry 3 times the request in case of error.
 *
 * This is already a lot in a few lines.
 */
const App = () => {
  const [saveSettings] = useObserveCallback(
    (trigger$) =>
      trigger$.pipe(switchMap((options) => from(sync(options)).pipe(retry(3)))),
    []
  )

  return (
    <>
      User settings
      <button onClick={() => saveSettings(/** ... */)}>save settings</button>
    </>
  )
}
```

It is recommended to use native hook as much as possible but observable can help dealing with more complex
use case when needed.

## Higher level API: Queries & Mutations

Realistically you are unlikely to use the low level API since react already provide convenient way to dea

## Global State

Because observables are by design observable, well, they are already a perfect candidate for state which is exactly what `signal` is:

```typescript
const [useColorMode, setColorMode] = signal({ default: "day" })

const AppBar = () => {
  return (
    <>
      <button
        onClick={() =>
          setColorMode((mode) => (mode === "day" ? "night" : "day"))
        }
      >
        switch mode
      </button>
    </>
  )
}

const App = () => {
  const colorMode = useColorMode()

  return (
    <>
      <AppBar />
      You are using {colorMode}
    </>
  )
}
```

# Side effects, mutations and their scopes

`reactjrx` provide conveniant way or running mutation or side effect both locally or globally.
`useMutation` is designed to run locally in a component scope and will by default cancel any ongoing mutation
once you run the same mutation again or if the component unmount. `useSubscribeEffect` and `trigger` however will give
you a base to build global long running side effects.

# Here is a couple of use case to understand what to use and when:

## I have a global state that needs to be shared

You can use `signal`.

## I want to trigger an action from somewhere else in the code

You can use `trigger`.

## I want to have side effect which runs when a specific action is triggered

If your side effect is scoped or local to your component you can use `useMutation`.
If your side effect needs to be triggered from anywhere and or your side effect is a long
running process you can use `trigger` and `useSubscribeEffect`.

# Low level functions

`useObserve` and `useSubscribe` are both the fundamental building blocks of this library. They are exported
and can be used to easily bind rxjs with react but we recommend you to use higher level function which
are more suited to use with react. For example `useQuery` replaces `useObserve` and will add error handling,
automatic retry, logging, loading state, etc. `useSubscribeEffect` is similar to `useSubscribe` but will
make sure to retry on error, log errors, etc.

# Author

Maxime Bret (bret.maxime@gmail.com).

# License

Open source and available under the MIT License.
