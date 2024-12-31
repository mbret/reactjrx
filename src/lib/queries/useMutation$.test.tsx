import { afterEach, describe, expect, it } from "vitest";
import { finalize, takeUntil, timer, ReplaySubject } from "rxjs";
import { render, cleanup } from "@testing-library/react";
import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMutation$ } from "./useMutation$";
import { waitForTimeout } from "../../tests/utils";
import { QueryClientProvider$ } from "./QueryClientProvider$";

afterEach(() => {
	cleanup();
});

describe("useMutation", () => {
	describe("Given component unmount", () => {
		describe("when there is an active query occurring", () => {
			/**
			 * @disclaimer
			 * I could not find a way to test the completeness of the inner observable without "cheating"
			 * by adding a hook. It's anti pattern but will do it until I find better way
			 */
			it("should complete main observable chain when mutation finish", async () => {
				let finalized = 0;
				let unmountTime = 0;
				const manualStop = new ReplaySubject<void>();

				const client = new QueryClient();

				const Comp = () => {
					const { mutate } = useMutation$({
						mutationFn: () =>
							timer(1000).pipe(
								takeUntil(manualStop),
								finalize(() => {
									finalized++;
								}),
							),
					});

					useEffect(() => {
						mutate();

						return () => {
							unmountTime++;
						};
					}, [mutate]);

					return null;
				};

				const { unmount } = render(
					<React.StrictMode>
						<QueryClientProvider client={client}>
							<QueryClientProvider$>
								<Comp />
							</QueryClientProvider$>
						</QueryClientProvider>
					</React.StrictMode>,
				);

				unmount();

				// observable should not be forcefully closed
				expect(finalized).toBe(0);

				// we simulate a long observable to stop after a while
				manualStop.next();

				await waitForTimeout(10);

				expect(finalized).toBe(unmountTime);
			});
		});
	});
});
