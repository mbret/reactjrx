# About

## reactjrx

Innovative library designed to bridge RxJS and frontend library / frameworks, offering developers a powerful set of tools to integrate observables into their React, Svelte or other applications seamlessly.

**Only React is supported at the moment**

It simplifies the reactive programming approach by providing easy-to-use bindings for observing and reacting to data changes, coupled with advanced state management and queries helpers akin to `react-query` for handling effects, mutations, and asynchronous data fetching.

Tailored for projects where RxJS is a core dependency, `reactjrx` enhances the development experience by enabling more dynamic, efficient, and responsive UIs, making it an essential addition for developers looking to leverage the full potential of RxJS within their React applications.

Please visit the [documentation](https://bret-maxime.gitbook.io/reactjrx/) for more information on how to use.

## TLDNR;

* If you want state management visit [state](https://app.gitbook.com/s/uE1Z7PHuhXh0NunQ33Mr/state-signal).
* If you want queries / mutations visit [queries](./#queries).
* If you want rxjs bindings visit [bindings](https://app.gitbook.com/s/uE1Z7PHuhXh0NunQ33Mr/bindings).

## Quick overview

### Low level API: RxJS bindings

{% hint style="info" %}
Before using the low level api you may want to ensure whether [signals](state-signal/about.md) or [queries](https://app.gitbook.com/s/uE1Z7PHuhXh0NunQ33Mr/queries) are not better suited for your needs. Although there is nothing wrong with it (we actually use it under the hood for the higher level api) they generally don't provide the optimisation or convenient API you will find with signals or queries. Beside they can create confusion since they are quite far from the React philosophy
{% endhint %}

The low level API provide all the building blocks to bind rxjs to react and the higher API. For example let's assume you have a package that expose observables, you can bind them easily:

```typescript
const interval$ = interval(100)

// useSubscribe needs a stable source, or it subscribes again at every render
const logInterval$ = interval$.pipe(
  tap((value) => {
    console.log("counter update", value)
  })
)

const App = () => {
  // observe the latest value of an observable
  const { data: counter } = useObserve(interval$)

  // a stream of vote clicks
  const vote$ = useConstant(() => new Subject<void>())

  // subscribe to an observable without rendering its values
  useSubscribe(logInterval$)

  /**
   * Here we handle API request and its status on user click.
   * Note that queries are more appropriate for such things.
   * Again this is to show how the low level API can be used.
   */
  const { data: voting } = useObserve(
    () =>
      vote$.pipe(
        switchMap(() =>
          concat(
            of({ status: "fetching" }),
            from(
              fetch("/api/vote", { method: "post" }).then((response) =>
                response.json()
              )
            ).pipe(
              map(({ numberOfVotes }) => ({
                status: "success",
                votes: numberOfVotes
              })),
              catchError((error) => of({ status: "error", error }))
            )
          )
        ),
        scan((state, update) => ({ ...state, ...update }), {
          status: "idle",
          votes: 0
        })
      ),
    { defaultValue: { status: "idle", votes: 0 } },
    [vote$]
  )

  return (
    <>
      Counter {counter}
      <button
        onClick={() => vote$.next()}
        disabled={voting.status === "fetching"}
      >
        Vote!
      </button>
      <div>You voted {voting.votes} times!</div>
    </>
  )
}
```

### State management (signals)

Signals are a higher level API which lets you manage your global or simply shared state:

```typescript
const voteSignal = signal({
  default: 0,
  // key is optional but required if you want to persist your signal
  key: "vote"
})

// a stable adapter, created once
const adapter = createLocalStorageAdapter()

const App = () => {
  const vote = useSignalValue(voteSignal)

  // persist and hydrate your signals easily
  const { isHydrated } = usePersistSignals({
    adapter,
    entries: [{ signal: voteSignal, version: 0 }]
  })

  // You can easily delay your app until your state is hydrated
  if (!isHydrated) return null

  return (
    <>
      <button
        onClick={() =>
          // update takes a value, or a function of the previous one
          voteSignal.update((previousVotes) => previousVotes + 1)
        }
      >
        Vote!
      </button>
      <div>You voted {vote} times!</div>
    </>
  )
}
```

### Queries

Wrapper to [https://tanstack.com/query](https://tanstack.com/query) which lets you use observables in your queries / mutations.

```typescript
const App = () => {
  const { data: users, status, error } = useQuery$({
    queryKey: ["users"],
    queryFn: () => {
      // returns an observable that emit users
      // we can stop at the first result but we can
      // also keep listening to the observable and return
      // new value whenever they arrive
      return db.users$.pipe(first())
    }
  })

  const {
    mutate: addNewUser,
    status: addUserStatus,
    data: newUser
  } = useMutation$({
    // an observable as well: the mutation resolves with its first value
    mutationFn: (user) => from(db.users.add(user))
  })

  return (
    <div>
      {status === "pending" && <div>Fetching users...</div>}
      {!!error && <div>An error occured while fetching users</div>}
      <div>You have {users?.length} users</div>
      <button
        onClick={() => {
          addNewUser({ id: "new id", name: "new user" })
        }}
      >
        add new user
      </button>
      {addUserStatus === "success" && (
        <div>New user {newUser.name} added with success</div>
      )}
    </div>
  )
}
```
