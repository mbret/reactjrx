import { afterEach, describe, expect, it } from "vitest";
import { Subject, interval, takeWhile } from "rxjs";
import { render, cleanup } from "@testing-library/react";
import React, { memo, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery$ } from "./useQuery$";
import { waitForTimeout } from "../../tests/utils";
import { QueryClientProvider$ } from "./QueryClientProvider$";

afterEach(() => {
	cleanup();
});

describe("Given a query that returns an interval stream", () => {
	it("should return consecutive results", async () => {
		const Comp = () => {
			const [values, setValues] = useState<Array<number | undefined>>([]);

			const { data } = useQuery$({
				queryKey: [],
				queryFn: () => interval(10), // 10 is long enough for avoiding react batching
			});

			useEffect(() => {
				data && setValues((v) => [...v, data]);
			}, [data]);

			return <>{JSON.stringify(values)}</>;
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

		expect(await findByText(JSON.stringify([1, 2, 3]))).toBeDefined();
	});
});

it("should return consecutive results", async () => {
	// interval big enough so react does not skip some render
	const source = interval(5).pipe(takeWhile((value) => value < 5, true));
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const states: any = [];

	const Comp = memo(() => {
		const state = useQuery$({ queryKey: [], queryFn: source });

		const { data } = state;

		states.push(state);

		return <>{data}</>;
	});

	const client = new QueryClient();

	const { findByText } = render(
		<QueryClientProvider client={client}>
			<QueryClientProvider$>
				<Comp />
			</QueryClientProvider$>
		</QueryClientProvider>,
	);

	expect(await findByText("5")).toBeDefined();

	expect(states[0]).toMatchObject({
		data: undefined,
		status: "pending",
		fetchStatus: "fetching",
	});

	expect(states[1]).toMatchObject({
		data: 0,
		fetchStatus: "fetching",
	});

	expect(states[2]).toMatchObject({
		data: 1,
		fetchStatus: "fetching",
	});

	expect(states[3]).toMatchObject({
		data: 2,
		fetchStatus: "fetching",
	});

	expect(states[4]).toMatchObject({
		data: 3,
		fetchStatus: "fetching",
	});

	expect(states[5]).toMatchObject({
		data: 4,
		fetchStatus: "fetching",
	});

	expect(states[6]).toMatchObject({
		data: 5,
		fetchStatus: "idle",
		status: "success",
	});
});

it("should return consecutive results", async () => {
	const source = new Subject<number>();

	const Comp = () => {
		const [values, setValues] = useState<Array<number | undefined>>([]);

		const queryResult = useQuery$({ queryKey: [], queryFn: source });

		const { data } = queryResult;

		useEffect(() => {
			data && setValues((v) => [...v, data]);
		}, [data]);

		return <>{JSON.stringify(values)}</>;
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

	source.next(3);

	await waitForTimeout(10);

	source.next(2);

	await waitForTimeout(10);

	source.next(1);

	expect(await findByText(JSON.stringify([3, 2, 1]))).toBeDefined();
});
