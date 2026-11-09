# useMutation$

## Run mutations one after another

Mutations run in parallel by default. Mutations that share a `scope.id` run one after another instead: each one starts once the one before it has succeeded or failed.

```tsx
const { mutate } = useMutation$({
  scope: { id: "save-settings" },
  mutationFn: (settings: Settings) => from(saveSettings(settings)),
})
```

A mutation settles on the first value its stream emits, and unsubscribes from the stream there. The next mutation of the scope starts then. So the first value must be the result: a stream that emits a progress value first stops at that value.

`scope` is a TanStack Query option: the queue holds every mutation of the `QueryClient` with that id, whichever component started it. See [Mutation Scopes](https://tanstack.com/query/latest/docs/framework/react/guides/mutations#mutation-scopes).
