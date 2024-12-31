import {
	type DefaultError,
	type MutationKey,
	type QueryClient,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
	BehaviorSubject,
	type Subject,
	filter,
	first,
	noop,
	switchMap,
} from "rxjs";
import { type UseMutation$Options, useMutation$ } from "./useMutation$";

export function useContactMutation$<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TContext = unknown,
>(
	options: UseMutation$Options<TData | null, TError, TVariables, TContext> & {
		mutationKey: MutationKey;
	},
	queryClient?: QueryClient,
) {
	const client = useQueryClient(queryClient);
	type TDataOrNull = TData | null;
	const mutationKey = options.mutationKey;

	const { mutateAsync, ...rest } = useMutation$<
		TDataOrNull,
		TError,
		{ variables: TVariables; ready$: Subject<boolean> },
		TContext
	>(
		{
			...options,
			onMutate({ variables }) {
				return options.onMutate?.(variables);
			},
			onSuccess(data, variables, context) {
				return options.onSuccess?.(data, variables.variables, context);
			},
			onError(error, variables, context) {
				return options.onError?.(error, variables.variables, context);
			},
			onSettled(data, error, variables, context) {
				return options.onSettled?.(data, error, variables.variables, context);
			},
			mutationFn: ({ ready$, variables }) => {
				const source =
					typeof options.mutationFn === "function"
						? options.mutationFn(variables)
						: options.mutationFn;

				return ready$.pipe(
					filter((isReady) => isReady),
					first(),
					switchMap(() => source),
				);
			},
		},
		queryClient,
	);

	const mutateAsyncConcat = useCallback(
		async (variables: TVariables) => {
			const mutations = client.getMutationCache().findAll({
				mutationKey,
				exact: true,
			});

			const subject = new BehaviorSubject(false);

			const result = mutateAsync({ variables, ready$: subject });

			await Promise.all(
				mutations.map((mutation) => mutation.continue().catch(noop)),
			);

			subject.next(true);

			return await result.finally(() => {
				subject.complete();
			});
		},
		[mutateAsync, client, mutationKey],
	);

	const mutateConcat = useCallback(
		(variables: TVariables) => {
			mutateAsyncConcat(variables).catch(noop);
		},
		[mutateAsyncConcat],
	);

	return { ...rest, mutate: mutateConcat, mutateAsync: mutateAsyncConcat };
}
