import { type QueryKey } from "../keys/types"

export const getInitialQueryEntity = ({ key }: { key: QueryKey }) => ({
  isStale: true,
  queryKey: key,
  runners: []
})
