# useEffectOnce

React lifecycle hook that runs an effect once, when the component mounts.

{% hint style="warning" %}
In development, under `<StrictMode>`, React mounts each component twice. So the effect runs twice, with its cleanup between the two runs. Make the cleanup undo the effect.
{% endhint %}

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
