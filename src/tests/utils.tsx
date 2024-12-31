import { act } from "@testing-library/react";
import * as utils from "../lib/utils";

export const waitForTimeout = async (timeout: number) =>
	await new Promise<undefined>((resolve) => setTimeout(resolve, timeout));

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export async function sleep(timeout: number): Promise<void> {
	await waitForTimeout(timeout);
}

/**
 * @see https://github.com/TanStack/query/blob/main/packages/react-query/src/__tests__/utils.tsx
 */
export function setActTimeout(fn: () => void, ms?: number) {
	return setTimeout(() => {
		act(() => {
			fn();
		});
	}, ms);
}

export const doNotExecute = (_func: () => void) => true;

/**
 * Assert the parameter is not typed as `any`
 */
export function expectTypeNotAny<T>(_: 0 extends 1 & T ? never : T): void {
	// biome-ignore lint/correctness/noVoidTypeReturn: <explanation>
	return undefined;
}

// This monkey-patches the isServer-value from utils,
// so that we can pretend to be in a server environment
export function setIsServer(isServer: boolean) {
	const original = utils.isServer;
	Object.defineProperty(utils, "isServer", {
		get: () => isServer,
	});

	return () => {
		Object.defineProperty(utils, "isServer", {
			get: () => original,
		});
	};
}
