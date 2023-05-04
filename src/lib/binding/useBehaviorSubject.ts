import { useEffect, useRef } from 'react'
import { BehaviorSubject } from 'rxjs'
import { useConstant } from '../utils/useConstant'

/**
 * @important
 * Because of React 18 and its strict mode
 * - concurrency means that effect can run more than once without committing
 * - state & ref can be reused across remount
 *
 * This means that using regular useRef for subject and calling a complete() on
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
  const subject = useConstant(() => new BehaviorSubject(state))
  const completed = useRef(false)

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
