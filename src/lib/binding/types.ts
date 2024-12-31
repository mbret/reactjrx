import type { Observable } from "rxjs";

export type SubscribeSourceFactory<Data> =
	| (() => Observable<Data>)
	| (() => Observable<Data> | undefined)
	| (() => Promise<Data>)
	| (() => Data);

export type SubscribeSource<Data> =
	| SubscribeSourceFactory<Data>
	| Promise<Data>
	| Observable<Data>
	| Data;
