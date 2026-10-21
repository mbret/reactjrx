# Getting Started

## Installation

You need to install the library together with `RxJS`. `RxJS` is most likely already a dependency of your project. If it's not the case, please consider whether `reactjrx` is the right choice for your project and your team since `RxJS` is a specific paradigm that involves specific conception architecture.

```bash
npm install reactjrx rxjs
```

## React

The queries (`useQuery$`, `useMutation$`...) run on [TanStack Query](https://tanstack.com/query/latest), version 5.85.1 or later. If you plan on using them, install it and wrap your app with its `QueryClientProvider`.

```bash
npm install @tanstack/react-query
```

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const client = new QueryClient()

export const App = () => (
    <QueryClientProvider client={client}>
        ...
    </QueryClientProvider>
)
```
