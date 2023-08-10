import { type Observable } from "rxjs"

export const createDeduplicationStore = () => {
    return new Map<string, Observable<any>>()
}