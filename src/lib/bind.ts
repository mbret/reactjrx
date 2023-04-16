import { Observable } from "rxjs";
import { useObserve } from "./useObserve";
import { shareLatest } from "./utils/shareLatest";

export const bind = <T>({
  stream,
  default: defaultValue,
}: {
  stream: Observable<T>;
  default: T;
}) => {
  const sharedStream = stream.pipe(shareLatest());

  const hook = () => useObserve(sharedStream, { defaultValue });

  return [hook, sharedStream] as const;
};
