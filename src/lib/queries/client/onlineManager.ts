import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  first,
  fromEvent,
  map,
  merge
} from "rxjs"
import { emitToSubject } from "../../utils/operators/emitToSubject"

export class OnlineManager {
  protected isOnlineSubject = new BehaviorSubject(true)

  public readonly online$ = this.isOnlineSubject
    .asObservable()
    .pipe(distinctUntilChanged())

  public readonly backToOnline$ = this.online$.pipe(
    filter((isOnline) => isOnline),
    first()
  )

  constructor() {
    merge(
      fromEvent(window, "offline").pipe(map(() => false)),
      fromEvent(window, "online").pipe(map(() => true))
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
