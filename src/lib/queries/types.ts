export type QuerxOptions = {
  enabled?: boolean
  // eslint-disable-next-line no-unused-vars
  retry?: number | ((attempt: number, error: unknown) => boolean)
  // @todo
  refetchOnWindowFocus?: boolean
  // @todo
  refetchOnMount?: boolean
  // @todo
  staleTime?: number
  onError?: (error: unknown) => void
  onSuccess?: () => void
}
