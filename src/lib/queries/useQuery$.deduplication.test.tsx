import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { Subject, interval, map, take, tap } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";
import { QueryClientProvider$ } from "./QueryClientProvider$";
import { useQuery$ } from "./useQuery$";

afterEach(() => {
  cleanup();
});

describe("Given a query that takes time to finish", () => {
  describe("when a second useQuery is mounted with the same key", () => {
    it("should run observable only once", async () => {
      let tapped = 0;
      const trigger = new Subject<void>();

      const Comp = () => {
        const query = () =>
          trigger.pipe(
            tap(() => {
              tapped++;
            }),
            map(() => "foo"),
          );

        useQuery$({ queryKey: ["foo"], queryFn: query });
        useQuery$({
          queryKey: ["foo"],
          queryFn: query,
          refetchOnMount: false,
        });

        return null;
      };

      const client = new QueryClient();

      render(
        <QueryClientProvider client={client}>
          <QueryClientProvider$>
            <Comp />
          </QueryClientProvider$>
        </QueryClientProvider>,
      );

      expect(tapped).toBe(0);

      trigger.next();

      expect(tapped).toBe(1);

      /**
       * Because the stream never finished (subject).
       * it should stay in the deduplication layer and always
       * run once
       */
      trigger.next();

      expect(tapped).toBe(2);
    });

    describe("and the query has an immediate internal query", () => {
      it("should also run observable only once", async () => {
        let queryRanNumber = 0;

        const Comp = () => {
          const query = () => {
            queryRanNumber++;

            return interval(0).pipe(take(100));
          };

          const { data } = useQuery$({ queryKey: ["foo"], queryFn: query });
          const { data: data2 } = useQuery$({
            queryKey: ["foo"],
            queryFn: query,
          });
          useQuery$({
            queryKey: ["foo"],
            queryFn: query,
          });

          return (
            <>
              {data},{data2}
            </>
          );
        };

        const client = new QueryClient();

        const { findByText } = render(
          <React.StrictMode>
            <QueryClientProvider client={client}>
              <QueryClientProvider$>
                <Comp />
              </QueryClientProvider$>
            </QueryClientProvider>
          </React.StrictMode>,
        );

        expect(await findByText("10,10")).toBeDefined();
        // strict mode
        expect(queryRanNumber).toBe(2);
      });
    });
  });
});
