import { type Observable } from "rxjs"

export type SubscribeSource<Data> =
  | (() => Observable<Data>)
  | Promise<Data>
  | Observable<Data>
  | (() => Promise<Data>)
  | (() => Data)
  | Data
