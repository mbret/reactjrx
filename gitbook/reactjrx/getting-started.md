# Getting Started

## Installation

You need to install the library together with `RxJS`. `RxJS` is most likely already a dependency of your project. If it's not the case, please consider whether `reactjrx` is the right choice for your project and your team since `RxJS` is a specific paradigm that involves specific conception architecture.

```bash
npm install reactjrx rxjs
```

`reactjrx` is published as an ES module only. CommonJS code can load it with `require()` on Node.js 20.19 or later, or 22.12 or later. Its types need TypeScript 5.0 or later. In TypeScript, a CommonJS file needs `"module": "nodenext"` and TypeScript 5.8 or later to import them.

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
