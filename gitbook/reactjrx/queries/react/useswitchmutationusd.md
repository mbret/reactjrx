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

A cancelled call is not retried, whatever `retry` says. A call cancelled while it waits to be retried fails at once.

## Retries

`retry` and `retryDelay` work as in TanStack Query, the client's defaults included. TanStack Query cannot stop its wait between two attempts, so the hook waits `retryDelay` at the start of the next attempt instead, and a cancel ends that wait. A `MutationCache` sees a `retryDelay` of 0.

## Variables

The callbacks, the client's default callbacks included, receive the variables given to `mutate`, and `result.variables` holds them. The hook runs each call with `{ variables, abort }` as TanStack Query's variables, so a `MutationCache` and `useMutationState` see that object.
