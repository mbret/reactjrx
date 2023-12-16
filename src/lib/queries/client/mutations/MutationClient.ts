/* eslint-disable @typescript-eslint/naming-convention */
import {
  BehaviorSubject,
  filter,
  skip,
  distinctUntilChanged,
  take
} from "rxjs"
import { serializeKey } from "../keys/serializeKey"
import { type MutationOptions } from "./types"
import { createMutationRunner } from "./createMutationRunner"
import { shallowEqual } from "../../../utils/shallowEqual"
import { type QueryClient } from "../createClient"
import { type DefaultError } from "../types"

export class MutationClient {
  /**
   * Contain all active mutation for a given key.
   * A mutation ca have several triggers running (it is not necessarily one function running)
   *
   * @important
   * - automatically cleaned as soon as the last mutation is done for a given key
   */
  mutationRunnersByKey$ = new BehaviorSubject<
    Map<string, ReturnType<typeof createMutationRunner<any, any, any, any>>>
  >(new Map())

  constructor(public client: QueryClient) {}

  /**
   * @helper
   */
  setMutationRunnersByKey(
    key: string,
    value: ReturnType<typeof createMutationRunner>
  ) {
    const map = this.mutationRunnersByKey$.getValue()

    map.set(key, value)

    this.mutationRunnersByKey$.next(map)
  }

  /**
   * @helper
   */
  deleteMutationRunnersByKey(key: string) {
    const map = this.mutationRunnersByKey$.getValue()

    map.delete(key)

    this.mutationRunnersByKey$.next(map)
  }

  /**
   * @helper
   */
  getMutationRunnersByKey(key: string) {
    return this.mutationRunnersByKey$.getValue().get(key)
  }

  mutate<
    TData,
    TError = DefaultError,
    TVariables = void,
    TContext = unknown
  >(params: {
    options: MutationOptions<TData, TError, TVariables, TContext>
    args: TVariables
  }) {
    const { mutationKey } = params.options
    const serializedMutationKey = serializeKey(mutationKey)

    let mutationForKey = this.getMutationRunnersByKey(serializedMutationKey)

    if (!mutationForKey) {
      mutationForKey = {
        ...createMutationRunner({
          ...params.options,
          client: this.client,
          mutationCache: this.client.getMutationCache()
        }),
        mutationKey
      }

      this.setMutationRunnersByKey(serializedMutationKey, mutationForKey)

      // @todo change and verify if we unsubscribe
      mutationForKey.runner$.subscribe()

      // @todo runner should close by itself when there are no more mutations

      /**
       * @important
       * should have at least one first mutation so
       * should unsubscribe by itself once filter back to 0 run
       */
      this.client
        .getMutationCache()
        .mutationsBy({
          exact: true,
          mutationKey
        })
        .pipe(
          distinctUntilChanged(shallowEqual),
          skip(1),
          filter((items) => items.length === 0),
          take(1)
        )
        .subscribe(() => {
          mutationForKey?.destroy()

          this.deleteMutationRunnersByKey(serializedMutationKey)
        })
    }

    const mutation = this.client
      .getMutationCache()
      .build<TData, TError, TVariables, TContext>(this.client, params.options)

    mutationForKey.trigger(params)

    return mutation
  }

  destroy() {
    this.mutationRunnersByKey$.complete()
  }
}
