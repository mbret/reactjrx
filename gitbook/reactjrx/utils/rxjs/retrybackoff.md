# retryBackoff

An operator that resubscribes to the source when it errors, after a delay that grows with each error. By default it retries forever: pass `retry` to stop.

### Usage

```typescript
import { ajax } from "rxjs/ajax"
import { retryBackoff } from "reactjrx"

const user$ = ajax.getJSON("/api/user").pipe(
  retryBackoff({
    initialInterval: 500,
    maxInterval: 5_000,
    retry: (attempt) => attempt < 5,
  }),
)
```

This retries 5 times, after 500 ms, 1 s, 2 s, 4 s and 5 s. The sixth error goes through.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `initialInterval` | `100` | Base delay in ms. Retry `n` (from 0) waits `2^n * initialInterval`. |
| `maxInterval` | `Infinity` | Longest delay in ms. |
| `retry` | always `true` | `(attempt, error) => boolean`, with `attempt` from 0. Return `false` to stop retrying and let the error through. |
| `resetOnSuccess` | `false` | Each value the source emits resets the delay and the attempt count. |
| `backoffDelay` | `exponentialBackoffDelay` | `(attempt, initialInterval) => number`: the delay before retry `attempt`, capped at `maxInterval`. |
| `retryAfter` | none | `() => Observable`: each retry waits for its first value before its delay starts, to wait for the network to come back, for example. |
| `retryAfterDelay` | none | `(attempt, error) => boolean`, checked once the delay has passed. Return `false` to let the error through instead of retrying. |
| `caughtError` | none | `(errorCount, error) => Observable \| undefined`, called for each error that will be retried. The values of the Observable it returns are emitted before the retry. |
| `catchError` | none | `(errorCount, error) => Observable`, called once retrying stops. The Observable it returns replaces the error. |

### Reference

```typescript
function retryBackoff<T, TError>(
  config: RetryBackoffConfig<T, TError>,
): <T>(source: Observable<T>) => Observable<T>
```
