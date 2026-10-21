# useSubscribe

Subscribe to an observable.

```typescript
useSubscribe(observableOrFactory)
```

## Reference

```typescript
function App () {
    const logUser = useCallback(() => user$.pipe(
        tap(user => {
            console.log(user)
        })
    ), [])
    
    useSubscribe(logUser)
    
    return null
}
```

***

```typescript
function useSubscribe<T>(
  source: SubscribeSource<T>
)
```

```typescript
type SubscribeSourceFactory<Data> =
  | (() => Observable<Data>)
  | (() => Observable<Data> | undefined)
  | (() => Promise<Data>)
  | (() => Data)

type SubscribeSource<Data> =
  | SubscribeSourceFactory<Data>
  | Promise<Data>
  | Observable<Data>
  | Data
```

### Parameters

* `source` : Observable or factory. Your source should be stable if you don't wish to resubscribe at every render.

### Returns

`void`

### **Caveats**&#x20;

* You are responsible to catch errors in your observable. This hook simply subscribe to your source.
