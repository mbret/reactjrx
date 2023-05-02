export type QuerxOptions = {
  enabled?: boolean
  // eslint-disable-next-line no-unused-vars
  retry?: false | number | ((attempt: number, error: unknown) => boolean)
  // @todo
  refetchOnWindowFocus?: boolean
  // @todo
  refetchOnMount?: boolean
  staleTime?: number
  onError?: (error: unknown) => void
  onSuccess?: () => void
}
