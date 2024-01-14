import { fromEvent, map, merge, shareReplay, startWith, tap } from "rxjs"

export class OnlineManager {
  public readonly online$ = merge(
    fromEvent(window, "offline").pipe(map(() => false)),
    fromEvent(window, "online").pipe(map(() => true))
  ).pipe(startWith(true), shareReplay(1))

  #online = true

  constructor() {
    this.online$
      .pipe(
        tap((value) => {
          this.#online = value
        })
      )
      .subscribe()
  }

  isOnline() {
    return this.#online
  }
}

export const onlineManager = new OnlineManager()
