import { useEffect, useRef } from "react";

export const useConstant = <T>(fn: () => T) => {
  const ref = useRef<T>(undefined);

  if (!ref.current) {
    ref.current = fn();
  }

  useEffect(() => {
    /**
     * Because strict mode keep reference to the same ref when the component
     * is re-mounted we force a rewrite here to prevent weird behavior.
     * I don't know why react does that since it is I believe technically
     * wrong. useRef should persist across re-render, not re-mount.
     *
     * @important
     * The downside is that during dev the factory will be called again every
     * mount.
     */
    if (process.env.NODE_ENV === "development") {
      // ref.current = fn();
    }
  }, []);

  return ref as { current: T };
};
