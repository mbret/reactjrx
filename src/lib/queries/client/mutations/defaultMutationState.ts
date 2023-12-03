import { type MutationState } from "./types"

export const getDefaultMutationState = <TData>(): MutationState<TData> => ({
  context: {},
  data: undefined,
  error: null,
  status: "idle",
  submittedAt: 0,
  variables: undefined
})
