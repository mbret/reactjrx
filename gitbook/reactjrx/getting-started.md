# Getting Started

## Installation

You need to install the library together with `RxJS`. `RxJS` is most likely already a dependency of your project. If it's not the case, please consider whether `reactjrx` is the right choice for your project and your team since `RxJS` is a specific paradigm that involves specific conception architecture.

```bash
npm install reactjrx rxjs
```

## React

If you are using React and plan on using the queries you should wrap your app with the provider.

```tsx
import { QueryClientProvider, QueryClient } from "reactjrx"

const client = new QueryClient()

export const App = () => (
    <QueryClientProvider client={client}>
        ...
    </QueryClientProvider>
)

```

