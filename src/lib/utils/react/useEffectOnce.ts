import { type EffectCallback, useEffect } from "react"

export const useEffectOnce = (effect: EffectCallback) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to run the effect only once
  useEffect(effect, [])
}
