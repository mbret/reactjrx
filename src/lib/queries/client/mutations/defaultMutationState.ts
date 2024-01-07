import { type MutationState } from "./mutation/types";

export const getDefaultMutationState = <
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(): MutationState<TData, TError, TVariables, TContext> => ({
  context: undefined,
  data: undefined,
  error: null,
  status: "idle",
  submittedAt: 0,
  variables: undefined,
  failureCount: 0,
  failureReason: null,
  isPaused: false
})
