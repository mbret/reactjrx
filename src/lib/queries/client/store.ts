import {
  BehaviorSubject,
  type Observable,
  distinctUntilChanged,
  filter,
  from,
  map,
  mergeMap,
  pairwise,
  share,
  takeUntil,
  Subject,
  tap,
  merge,
  first
} from "rxjs"
import { arrayEqual } from "../../utils/arrayEqual"

export class Store<Entity extends { state$: Observable<any> }> {
  /**
   * @important
   * Query store. Could be turned into a map for more performance.
   */
  protected readonly entriesSubject = new BehaviorSubject<Entity[]>([])
  protected readonly changeSubject = new Subject<{
    type: "added"
    entity: Entity
  }>()

  public readonly entries$ = this.entriesSubject.pipe(
    distinctUntilChanged(arrayEqual),
    share()
  )

  public readonly added$ = this.changeSubject.pipe(
    filter(({ type }) => type === "added"),
    map(({ entity }) => entity),
    tap(() => {
      console.log("ADDED")
    }),
    share()
  )

  public readonly removed$ = this.entries$.pipe(
    pairwise(),
    map(([previous, current]) =>
      previous.filter((mutation) => !current.includes(mutation))
    ),
    mergeMap((removedItems) => from(removedItems)),
    share()
  )

  public readonly stateChange$ = merge(
    this.entriesSubject.pipe(
      first(),
      mergeMap((entities) => from(entities))
    ),
    this.added$
  ).pipe(
    mergeMap((entity) =>
      entity.state$.pipe(
        map(() => entity),
        takeUntil(
          this.removed$.pipe(
            filter((removedMutation) => removedMutation === entity)
          )
        )
      )
    ),
    share()
  )

  getValues() {
    return this.entriesSubject.getValue()
  }

  remove(entity: Entity) {
    this.entriesSubject.next(
      this.entriesSubject.getValue().filter((toRemove) => entity !== toRemove)
    )
  }

  add(entity: Entity) {
    this.entriesSubject.next([...this.entriesSubject.getValue(), entity])
    this.changeSubject.next({ type: "added", entity })
  }

  find(predicate: (entity: Entity) => boolean) {
    return this.entriesSubject.getValue().find(predicate)
  }
}
