import {
  BehaviorSubject,
  type Observable,
  filter,
  from,
  map,
  mergeMap,
  share,
  takeUntil,
  Subject,
  merge,
  first
} from "rxjs"

export class Store<Entity extends { state$: Observable<any> }> {
  /**
   * @important
   * Query store. Could be turned into a map for more performance.
   */
  protected readonly entriesSubject = new BehaviorSubject<Entity[]>([])
  protected readonly changeSubject = new Subject<
    { entity: Entity } & (
      | {
          type: "added"
        }
      | {
          type: "removed"
        }
    )
  >()

  public readonly entries$ = this.entriesSubject.pipe(share())

  public readonly added$ = this.changeSubject.pipe(
    filter(({ type }) => type === "added"),
    map(({ entity }) => entity),
    share()
  )

  public readonly removed$ = this.changeSubject.pipe(
    filter(({ type }) => type === "removed"),
    map(({ entity }) => entity),
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
    this.changeSubject.next({ type: "removed", entity })
  }

  add(entity: Entity) {
    this.entriesSubject.next([...this.entriesSubject.getValue(), entity])
    this.changeSubject.next({ type: "added", entity })
  }

  find(predicate: (entity: Entity) => boolean) {
    return this.entriesSubject.getValue().find(predicate)
  }
}
