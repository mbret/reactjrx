/* eslint-disable @typescript-eslint/ban-ts-comment */
import { isPlainObject } from "../../../utils/isPlainObject"
import { type MutationKey } from "../mutations/types"
import { type QueryKey } from "./types"

export const serializeObject = (object: any): string => {
  if (Array.isArray(object)) {
    return object.reduce((acc: string, value: any, index) => {
      if (index === object.length - 1) return `${acc}${serializeObject(value)}]`

      return `${acc}${serializeObject(value)},`
    }, "[")
  }

  if (object === undefined) return ""

  return JSON.stringify(object, Object.keys(object).sort())
}

export const serializeKey = (queryKey: QueryKey | MutationKey) => {
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

export const hashKey = serializeKey
