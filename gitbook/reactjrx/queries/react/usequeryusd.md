# useQuery$

This hook is similar to [useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery) but takes an observable or an observable factory as queryFn.

```tsx
const MyComponent = ({ userId }) => {
  const { data } = useQuery$({
    queryKey: ["time"],
    queryFn: () => interval(1000)
  })
 
  return <div>{data} seconds elapsed since mounted!</div>
}
```

