import { type QueryKey, hashKey } from "@tanstack/react-query";
import { createContext, memo, useContext, useEffect, useState } from "react";
import {
  type Observable,
  type Subscription,
  fromEvent,
  share,
  takeUntil,
} from "rxjs";

type CacheEntry = {
  query$: Observable<unknown>;
  signal: AbortSignal;
  sub: Subscription | undefined;
  isCompleted: boolean;
  lastData: { value: unknown } | undefined;
};

export class QueryClient$ {
  public readonly queryMap: Map<string, CacheEntry> = new Map();

  getQuery(queryHash: string) {
    return this.queryMap.get(queryHash);
  }

  setQuery(
    queryKey: QueryKey,
    query$: Observable<unknown>,
    signal: AbortSignal,
  ) {
    const queryHash = hashKey(queryKey);

    const sharedQuery$ = query$.pipe(
      /**
       * abort signal is triggered on:
       * - manual cancellation from user
       * - unmounting the component
       * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
       */
      takeUntil(fromEvent(signal, "abort")),
      share(),
    );

    const cacheEntry: CacheEntry = {
      query$: sharedQuery$,
      signal,
      sub: undefined,
      isCompleted: false,
      lastData: undefined,
    };

    this.queryMap.set(queryHash, cacheEntry);

    const sub = sharedQuery$.subscribe({
      next: (data) => {
        const entry = this.queryMap.get(queryHash);

        if (entry) {
          entry.lastData = { value: data };
        }
      },
      complete: () => {
        this.deleteQuery(queryHash);
      },
    });

    cacheEntry.sub = sub;

    return cacheEntry;
  }

  deleteQuery(queryHash: string) {
    const entry = this.queryMap.get(queryHash);

    if (!entry) return;

    if (entry.sub) {
      entry.sub.unsubscribe();
      entry.sub = undefined;
    }

    entry.isCompleted = true;

    this.queryMap.delete(queryHash);
  }

  destroy() {
    this.queryMap.forEach((_, key) => {
      this.deleteQuery(key);
    });
  }
}

export const Context = createContext<QueryClient$ | undefined>(undefined);

export const QueryClientProvider$ = memo(
  ({
    children,
    client: _client,
  }: {
    children: React.ReactNode;
    client?: QueryClient$;
  }) => {
    const [client] = useState(() => _client ?? new QueryClient$());

    useEffect(() => {
      return () => {
        client.destroy();
      };
    }, [client]);

    return <Context.Provider value={client}>{children}</Context.Provider>;
  },
);

export const useQueryClient$ = () => {
  const client = useContext(Context);

  if (!client) {
    throw new Error(
      "useReactJrxQueryClient must be used within a ReactJrxQueryProvider",
    );
  }

  return client;
};
