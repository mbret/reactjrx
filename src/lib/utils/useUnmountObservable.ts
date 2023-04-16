import { useEffect } from "react";
import { useConstant } from "./useConstant";
import { Subject } from "rxjs";

export const useUnmountObservable = () => {
  const subject = useConstant(() => new Subject<void>());

  useEffect(() => {
    return () => {
      subject.current.next();
      subject.current.complete();
    };
  }, []);

  return subject;
};
