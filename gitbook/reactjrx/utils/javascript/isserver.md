# isServer

Tells you whether the current script is running on a server or browser environment. Supports `deno` environment.

### Usage

```typescript
import { isServer } from "reactjrx"

if (!isServer()) {
    // only access browser API when not on server
    console.log(`Your device is using ${ navigator.language } languages`)
}
```

### Reference

```typescript
isServer(): boolean
```
