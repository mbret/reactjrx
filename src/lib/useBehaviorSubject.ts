import { useEffect, useRef, useState } from "react"
import { BehaviorSubject } from "rxjs"

/**
 * @important
 * Because of React 18 and its strict mode
 * - concurrency means that effect can run more than once without committing
 * - state & ref can be reused across remount
 *
 * This means that using regular useRef for subject and callind a complete() on
 * unmount will not have the desired effects. Next effects will run with a completed
 * subject and crash.
 *
 * There is another pattern to the current implementation which is using useState and
 * do a setState on the second mount if the source has completed. This will trigger a new
 * commit and re-render with new subject. However I am not sure which one is correct
 * for now. Because of the simple first naive approach is using useRef I will use the
 * same but patch it to support Strict Mode
 *
 * @see https://github.com/reactwg/react-18/discussions/18
 * @see https://github.com/reactwg/react-18/discussions/19
 */
export const useBehaviorSubject = <S>(state: S) => {
  // const [params, setParams] = useState(() => ({
  //   subject: new BehaviorSubject(state),
  //   completed: false,
  // }));
  const subject = useRef(new BehaviorSubject(state))
  const completed = useRef(false)

  // useEffect(() => {
  //   // console.log("useBehaviorSubject params", params.subject.getValue());
  // }, [params]);

  // useEffect(() => {
  //   // console.log("useBehaviorSubject mount");

  //   // setParams((s) => {
  //   //   if (!s.completed) {
  //   //     return s;
  //   //   } else {
  //   //     return {
  //   //       subject: new BehaviorSubject(state),
  //   //       completed: false,
  //   //     };
  //   //   }
  //   // });

  //   return () => {
  //     /**
  //      * We complete subject in a timeout to give a chance to consumer
  //      * to eventually dispatch next() or other operation during
  //      * same effect cycle. Otherwise this would complete the subject
  //      * before any other operation can be done
  //      */
  //     const _p = params;

  //     // setTimeout(() => {
  //     console.log("useBehaviorSubject complete");
  //     _p.subject.complete();
  //     // });

  //     setParams((s) => ({
  //       subject: new BehaviorSubject(state),
  //       completed: true,
  //     }));
  //   };
  // }, []);

  useEffect(() => {
    if (completed.current) {
      subject.current = new BehaviorSubject(state)
      completed.current = false
    }

    return () => {
      if (!completed.current) {
        subject.current.complete()
        completed.current = true
      }
    }
  }, [])

  return subject
}
