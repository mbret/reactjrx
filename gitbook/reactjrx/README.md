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

<pre class="language-typescript"><code class="lang-typescript">const interval$ = interval(100)

const App = () => {
  // observe the returned value of an observable
  const counter = useObserve(interval$)

  const [vote$, vote] = useObserveCallback()

  // subscribe to an observable. Similar to observe but
  // does not sync nor return the observable output with react.
<strong>  useSubscribe(
</strong>    () =>
      interval$.pipe(
        tap((value) => {
          console.log("counter update", value)
        })
      ),
    []
  )

  /**
   * Here we handle API request and its status on user click.
   * Note that queries are more appropriate for such things.
   * Again this is to show how the low level API can be used.
   */
  const { data, error, status } = useObserve(
    () =>
      vote$.pipe(
        switchMap(() =>
          merge(
            of({ error: undefined, status: "fetching" }),
            from(fetch("/api/vote", { method: "post" }))
          )
        ),
        map((response) => ({
          data: response.numberOfVotes,
          status: "success"
        })),
        catchError((error) => of({ data: undefined, error, status: "error" })),
<strong>        scan((acc, state) => ({ ...acc, ...state }), {
</strong>          data: undefined,
          error: undefined,
          status: "idle"
        })
      ),
    {
      defaultValue: { data: undefined, error: undefined, status: "idle" }
    },
    [vote$]
  )

  return (
    &#x3C;>
      Counter {counter}
      &#x3C;button onClick={() => vote()} disabled={status === "fetching"}>
        Vote!
      &#x3C;/button>
      &#x3C;div>You voted {data ?? 0} times!&#x3C;/div>
    &#x3C;/>
  )
}
</code></pre>

### State management (signals)

Signals are a higher level API which lets you manage your global or simply shared state:

```typescript
const voteSignal = signal({
  default: 0,
  // key is optional but required if you want to persist your signal
  key: "vote"
})

const App = () => {
  const vote = useSignalValue(voteSignal)

  // persist and hydrate your signals easily
  const { isHydrated } = usePersistSignals({
    entries: [{ signal: voteSignal, version: 0 }]
  })

  // You can easily delay your app until your state is hydrated
  if (!isHydrated) return null

  return (
    <>
      <button
        onClick={() =>
          // setValue can take a single value or a function that returns
          // previous state
          voteSignal.setValue((previousVotes) => previousVotes + 1)
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
  } = useMutation({
    mutationFn: (user) => db.users.add(user)
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
