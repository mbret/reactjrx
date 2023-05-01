import { Observable } from "rxjs"
import { useState } from "react"

export type QueryStore = Map<string, Observable<any>>

export const useQueryStore = () => {
  const [store] = useState<QueryStore>(new Map())

  return store
}
