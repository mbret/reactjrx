import { useEffectOnce } from "./useEffectOnce.ts"

export const useMount = (fn: () => void) => {
  useEffectOnce(() => {
    fn()
  })
}
