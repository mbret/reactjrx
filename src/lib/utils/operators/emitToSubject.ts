import type { MonoTypeOperatorFunction, Subject } from "rxjs";
import { tap } from "rxjs/operators";

export function emitToSubject<T>(
	subject: Subject<T>,
): MonoTypeOperatorFunction<T> {
	return (source$) =>
		source$.pipe(
			tap((value) => {
				subject.next(value);
			}),
		);
}
