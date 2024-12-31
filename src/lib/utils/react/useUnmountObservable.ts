import { useSubject } from "../../binding/useSubject";

export const useUnmountObservable = () => {
	const subject = useSubject<void>({
		onBeforeComplete: () => {
			subject.current.next();
		},
	});

	return subject;
};
