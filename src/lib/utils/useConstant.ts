import * as React from "react";

/**
 * useConstant hook returns a constant value computed by
 * calling the provided function only once during the
 * component's lifetime.
 *
 * @param {() => T} fn A function that computes and returns the constant value. The function is called only once, during the first render of the component.
 * @returns {T} The constant value computed by the provided function.
 *
 * @example
 * function MyComponent(props) {
 *   const constantValue = useConstant(() => {
 *     // Compute and return the constant value here
 *     return "Hello, world!";
 *   });
 *
 *   // Use the constant value in your component
 *   return <div>{constantValue}</div>;
 * }
 *
 */
export const useConstant = <T>(fn: () => T): T => {
  const ref = React.useRef<{ value: T }>();

  if (!ref.current) {
    ref.current = { value: fn() };
  }

  return ref.current.value;
};
