/* eslint-disable @typescript-eslint/ban-ts-comment */
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

export const serializeKey = (key: QueryKey | MutationKey) => {
  if (key.length === 0) return "[]"

  return serializeObject(key)
}
