# useEffectOnce

React lifecycle hook that runs an effect only once.

### Usage <a href="#usage" id="usage"></a>

```jsx
import {useEffectOnce} from 'reactjrx';

const Demo = () => {
  useEffectOnce(() => {
    console.log('Running effect once on mount')

    return () => {
      console.log('Running clean-up of effect on unmount')
    }
  });

  return null;
};
```

### Reference <a href="#reference" id="reference"></a>

```js
useEffectOnce(effect: EffectCallback);
```
