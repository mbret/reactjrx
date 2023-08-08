import { type QueryKey } from "./types"

const serializeObject = (object: any): string => {
  if (Array.isArray(object)) {
    return object.reduce((acc: string, value: any, index) => {
      if (index === object.length - 1) return `${acc}${serializeObject(value)}]`

      return `${acc}${serializeObject(value)},`
    }, "[")
  }

  return JSON.stringify(object, Object.keys(object).sort())
}

export const serializeKey = (key: QueryKey) => {
  if (key.length === 0) return "[]"

  return serializeObject(key)
}
