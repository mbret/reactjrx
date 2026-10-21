# Empty mutations

Mutations are expecting a value as result whether it's a promise or a stream. A stream however, can complete without any values.

## The problem

```typescript
useMutation$({
    mutationFn: (items: string[]) => {
        // we have an array of observable that we want to run in parallel
        const tasks$ = items.map(item => runTask(item))
        
        return combineLatest(tasks$)
    }
})
```

This mutation seems fine at first, we want to run a task on a list of items. What happens if the list of items is empty ? `combineLatest` will complete without any values. This is similar to returning or using `EMPTY` .

This scenario is not possible with a normal mutation but similar to returning undefined. `useMutation$` will throw an error if a mutation complete without emitting a value.

## The solution

There are several solutions to prevent this situation to happens but here is a simple trick.

**defaultIfEmpty**

```typescript
useMutation({
    mutationFn: (items: string[]) => {
        // we have an array of observable that we want to run in parallel
        const tasks$ = items.map(item => runTask(item))
        
        return combineLatest(tasks$).pipe(
            defaultIfEmpty(null)
        )
    }
})
```

This will ensure your mutation returns something even if it complete empty.

If the return is important for you, you can consider changing the value `null` into whatever makes more sense to you in this case.
