/* eslint-disable @typescript-eslint/ban-ts-comment */
import { isPlainObject } from "../../../utils/isPlainObject"
import { type MutationKey } from "../mutations/types"
import { type QueryKey } from "./types"

export const hashKey = (queryKey: QueryKey | MutationKey) => {
  return JSON.stringify(queryKey, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key]
            return result
            // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
          }, {} as any)
      : val
  )
}
