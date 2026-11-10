# useSwitchMutation$

`useSwitchMutation$` runs a mutation like `useMutation$`, and cancels the call still running when a new one starts. Use it when only the latest call matters, such as a search or a save that a newer value replaces.

```tsx
const { mutate } = useSwitchMutation$({
  mutationFn: (query: string) => from(search(query)),
})
```

## A cancelled call

A call that a newer call replaces stops its stream, and fails with `SwitchMutationCancelError`. That error reaches `onError` like any other error: the hook's own, or the client's default when the hook has none, and a `MutationCache`'s. Skip it where a replaced call should stay silent:

```tsx
onError: (error) => {
  if (error instanceof SwitchMutationCancelError) return

  showErrorToast(error)
}
```

A cancelled call is not retried, whatever `retry` says. A call cancelled while it waits `retryDelay` fails at once. One that TanStack Query holds, such as while the device is offline, fails when TanStack Query resumes it.

## Retries

`retry` and `retryDelay` take the same values as in TanStack Query, the client's defaults included. TanStack Query cannot stop its wait between two attempts, so the hook waits `retryDelay` itself, at the end of the failed attempt, and gives TanStack Query a `retryDelay` of 0, which a `MutationCache` sees. TanStack Query then holds the retry while the device is offline or the page hidden, as it does after its own wait.

Three things differ from TanStack Query:

- `failureCount` and `failureReason` change when the wait ends, not when the attempt fails. A call cancelled during the wait never records that failure.
- A `retry` function runs twice for each failure: once in the hook, to know whether to wait, and once in TanStack Query.
- A change to `retry` or `retryDelay` applies to the calls already running. TanStack Query keeps the values that a call started with.

## Variables

The callbacks, the client's default callbacks included, receive the variables given to `mutate`, and `result.variables` holds them. The hook runs each call with `{ variables, abort }` as TanStack Query's variables, so a `MutationCache` and `useMutationState` see that object.
