# About

Signals provide a lightweight, powerful approach to global state management built on top of RxJS. Signals extend RxJS observables to create reactive variables that are easy to use, combine, and listen to.

### Key Features

* Simplicity First: Signals are just reactive variables - no complicated effects or boilerplate
* Full TypeScript Support: Enjoy complete type safety with your state
* RxJS Foundation: Leverage the power of observables
* Composable: Easily combine signals to create derived state, effects, etc
* Framework Agnostic: Works with any UI framework or vanilla JavaScript

### Philosophy

ReactJRX Signals embrace a minimalist approach to state management. Instead of providing a complex ecosystem of effects, actions, and reducers, Signals focus on doing one thing well: providing reactive state variables that are easy to use and understand.This approach gives you the freedom to handle side effects and business logic in whatever way makes the most sense for your application, while still enjoying the benefits of reactive programming.

This is similar to [https://svelte.dev/docs/svelte/svelte-store](https://svelte.dev/docs/svelte/svelte-store) in its simplicity. We believe state management should be about state management and nothing else.&#x20;

### Signal: Reactive State with Superpowers

At the core of ReactJRX is the Signal class, which extends RxJS's BehaviorSubject. This means every Signal is a fully-featured Observable with all the power that brings, while adding specialized functionality for state management.

## `Signal`

At the core of ReactJRX is the `Signal` class, which extends RxJS's `BehaviorSubject`. This means every Signal is a fully-featured Observable with all the power that brings, while adding specialized functionality for state management.

### Anatomy of a Signal

```typescript
const counter = signal({ default: 0, key: 'app.counter' });
```

A Signal is defined by two optional properties:

* **default**: The initial value of the Signal
* **key**: A unique string identifier that can be used for persistence, debugging, or other purposes

### Beyond BehaviorSubject

While a Signal inherits all the capabilities of a BehaviorSubject, it enhances the experience with:

1.  **Type-Safe Updates**: The `update` method provides a safer and more convenient way to modify state:

    ```typescript
    // Update based on previous value
    counter.update(prev => prev + 1);

    // Set to a specific value
    counter.update(10);

    // Reset to default value
    counter.update(SIGNAL_RESET);
    ```
2.  **Configuration Access**: The Signal stores its configuration, making it available for plugins and extensions:

    ```typescript
    console.log(counter.config.default); // 0
    console.log(counter.key); // "app.counter"
    ```

### Extensibility Through Configuration

The `key` property enables powerful extensions like persistence:

```typescript
// Create signals with keys for persistence
const theme = signal({ default: 'light', key: 'settings.theme' });
const volume = signal({ default: 75, key: 'settings.volume' });

// Set up persistence for these signals
persistSignals({
  entries: [
    { signal: theme, version: 1 },
    { signal: volume, version: 1 }
  ],
  adapter: localStorageAdapter
});
```

This configuration-based approach allows you to add functionality like persistence, logging, or synchronization without complicating your state management code.

### Full Observable Compatibility

Since a Signal is an Observable, you can use it with all RxJS operators:

```typescript
import { map, debounceTime } from 'rxjs/operators';

// Create a derived stream with transformations
const debouncedCounter = counter.pipe(
  debounceTime(300),
  map(value => `Current count: ${value}`)
);

// Subscribe just like any Observable
debouncedCounter.subscribe(console.log);
```

## `VirtualSignal`

### Controlled State Lifecycles

While standard Signals provide app-wide state management, `VirtualSignal` offers a more controlled approach for library authors and component-scoped state. A VirtualSignal is not an Observable itself, but rather a reference to a Signal that will be instantiated within a specific context.

```typescript
const counterSignal = virtualSignal({ default: 0 });

// MyComp.tsx
const [counter, setCounter] = useSignal(counterSignal)
```

### Beyond Global Singletons

When you export a Signal from a module, it behaves as a singleton shared across your entire application. VirtualSignals break this pattern by:

1. **Deferring Instantiation**: A VirtualSignal is just a reference until it's resolved within a context
2. **Enabling Scoped State**: Multiple instances of the same VirtualSignal can exist in different contexts
3. **Controlling Lifecycle**: VirtualSignals are created and destroyed with their context

### Library Author's Tool

VirtualSignals are particularly valuable for library authors:

```typescript
// Library code
export const themeRef = virtualSignal({ default: 'light' });
export const userPreferencesRef = virtualSignal({ 
  default: { fontSize: 16, animations: true } 
});

// The actual Signals will be created by the library's context provider
```

This approach allows library users to have multiple instances of your state, each scoped to different parts of their application.

The VirtualSignal pattern is conceptually similar to libraries like [Jotai](https://jotai.org/), where atoms are references to state that must be used within a provider context. This creates a clear separation between state definition and state instantiation.

When a VirtualSignal is used within its appropriate context, it resolves to a real Signal:

```typescript
// Within a context provider
const [theme, setTheme, themeSignal] = useSignal(themeRef);  // Now a full Signal instance

// Use like any other Signal
setTheme('dark');
themeSignal.subscribe(value => console.log(`Theme changed to ${value}`));
```

This pattern combines the flexibility of context-based state with the power and simplicity of Signals, giving library authors fine-grained control over state lifecycle while maintaining a familiar reactive API for consumers.
