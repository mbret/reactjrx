# reactjrx

ReactJRX is a TypeScript library that provides a simple and efficient API for handling global state management, flow control, and query control in React applications using RxJS. With a small footprint and scalability to suit any project size, ReactJRX is a great alternative to other popular libraries such as Recoil, Redux, React Query, and Zustand.

# Installation

To install Reactjrx, simply run:

```
npm install reactjrx
```

# Overview

- `signal` global state
- `trigger` global action trigger
- `useQuery` execute queries (promises, observable, ...)
- `useMutation` execute mutations (promises, observable, ...)
- `useSubscribeEffect` run observable as side effect

```typescript
@todo
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
