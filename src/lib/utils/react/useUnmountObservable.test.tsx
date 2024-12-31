import { render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { BehaviorSubject, takeUntil } from "rxjs";
import { describe, expect, it } from "vitest";
import { useUnmountObservable } from "./useUnmountObservable";

describe("useUnmountObservable", () => {
	it("should not update source2 after unmounted", async () => {
		const source = new BehaviorSubject(0);
		const source2 = new BehaviorSubject(0);

		const Comp = () => {
			const unmount$ = useUnmountObservable();

			useEffect(() => {
				source.pipe(takeUntil(unmount$.current)).subscribe(source2);
			}, [unmount$]);

			return null;
		};

		const { unmount } = render(
			<StrictMode>
				<Comp />
			</StrictMode>,
		);

		source.next(1);

		expect(source2.getValue()).toBe(1);

		unmount();

		source.next(2);

		expect(source2.getValue()).toBe(1);
	});
});
