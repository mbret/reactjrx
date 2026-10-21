# useMount

React lifecycle hook that calls a function after the component is mounted. Use `useLifecycles` if you need both a mount and unmount function.

### Usage <a href="#usage" id="usage"></a>

```jsx
import {useMount} from 'reactjrx';

const Demo = () => {
  useMount(() => alert('MOUNTED'));
  return null;
};
```

### Reference <a href="#reference" id="reference"></a>

```ts
useMount(fn: () => void);
```
