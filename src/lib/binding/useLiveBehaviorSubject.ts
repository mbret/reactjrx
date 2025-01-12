import { useEffect } from "react";
import { useBehaviorSubject } from "./useBehaviorSubject";

export const useLiveBehaviorSubject = <S>(state: S) => {
  const subject = useBehaviorSubject(state);

  useEffect(() => {
    subject.current.next(state);
  }, [state, subject]);

  return subject;
};
