import { useCallback } from "react";
import { useSubject } from "./useSubject";
import type { Observable } from "rxjs";

/**
 * This creates an event handler and an observable that represents calls to that handler.
 */
export const useObservableCallback = <T = void>(): readonly [
	Observable<T>,
	(arg: T) => void,
] => {
	const subject = useSubject<T>();

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const trigger = useCallback((arg: T) => {
		subject.current.next(arg);
	}, []);

	return [subject.current, trigger] as const;
};
