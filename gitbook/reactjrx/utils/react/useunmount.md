# useUnmount

React lifecycle hook that calls a function when the component unmounts. It calls the `fn` of the last committed render.

{% hint style="warning" %}
In development, under `<StrictMode>`, React mounts each component twice. So `useUnmount` also calls `fn` once after the first mount, while the component stays mounted. Do not end work there that the component still uses, such as a subject that it reads.
{% endhint %}

### Usage

```jsx
import {useUnmount} from 'reactjrx';

const Demo = ({ onClose }) => {
  useUnmount(() => onClose());
  return null;
};
```

### Reference

```ts
useUnmount(fn: () => any);
```
