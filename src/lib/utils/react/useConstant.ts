import { useRefOnce } from "./useRefOnce"

export const useConstant = <T>(fn: () => T) => {
  const ref = useRefOnce(fn)

  return ref.current
}
