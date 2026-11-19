import { useRefOnce } from "./useRefOnce.ts"

export const useConstant = <T>(fn: () => T) => {
  const ref = useRefOnce(fn)

  return ref.current
}
