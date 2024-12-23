import {
  BehaviorSubject,
  EMPTY,
  distinctUntilChanged,
  filter,
  first,
  fromEvent,
  map,
  merge
} from "rxjs"
import { emitToSubject } from "../../utils/operators/emitToSubject"
import { isServer } from "../../utils"

export class OnlineManager {
  protected isOnlineSubject = new BehaviorSubject(true)

  public readonly online$ = this.isOnlineSubject.pipe(distinctUntilChanged())

  public readonly backToOnline$ = this.online$.pipe(
    filter((isOnline) => isOnline),
    first()
  )

  constructor() {
    merge(
      isServer ? EMPTY : fromEvent(window, "offline").pipe(map(() => false)),
      isServer ? EMPTY : fromEvent(window, "online").pipe(map(() => true))
    )
      .pipe(emitToSubject(this.isOnlineSubject))
      .subscribe()
  }

  isOnline() {
    return this.isOnlineSubject.getValue()
  }

  setOnline(online: boolean) {
    const changed = this.isOnlineSubject.getValue() !== online

    if (changed) {
      this.isOnlineSubject.next(online)
    }
  }
}

export const onlineManager = new OnlineManager()
