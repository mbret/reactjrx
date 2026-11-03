# useMount

React lifecycle hook that calls a function after the component is mounted.

{% hint style="warning" %}
In development, under `<StrictMode>`, React mounts each component twice. So `useMount` calls `fn` twice. Make `fn` safe to call twice, or use `useEffectOnce` and undo the work in its cleanup.
{% endhint %}

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
