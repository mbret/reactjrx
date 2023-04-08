import { useLayoutEffect, useRef } from "react";

export const useLiveRef = <T>(value: T) => {
  const ref = useRef(value);

  /**
   * We dont update the value on render because of potential
   * bug related to react concurrency mode.
   * We don't update the value in a useEffect because effects run after
   * render and we could maybe? have situation where the ref
   * is being called after render but before effect?
   * I am not sure of that one.
   *
   * `useLayoutEffect` is a good compromise since it runs after render but before
   * repain. It prevents the concurrency mode issue.
   */
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
};
