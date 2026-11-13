import { act, render, renderHook } from "@testing-library/react"
import {
  Activity,
  Component,
  type ReactNode,
  StrictMode,
  Suspense,
  startTransition,
  use,
  useLayoutEffect,
  useState,
} from "react"
import {
  BehaviorSubject,
  concat,
  map,
  NEVER,
  ObjectUnsubscribedError,
  type Observable,
  of,
  Subject,
} from "rxjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { countSubscriptions } from "../../../tests/liveQuery"
import { useObserve } from "./useObserve"

const createPendingPromise = () => {
  let resolve = () => {}
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

class CatchError extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Given a render that React commits", () => {
  it("subscribes once to the source while mounted, and unsubscribes once unmounted", () => {
    const { counted$, subscriptions } = countSubscriptions(
      new BehaviorSubject(1),
    )

    function Observer() {
      "use no memo"
      const { data } = useObserve(counted$)

      return <>{data}</>
    }

    const { unmount, container } = render(<Observer />)

    expect(container.textContent).toBe("1")
    expect(subscriptions).toEqual({ made: 1, open: 1 })

    unmount()

    expect(subscriptions.open).toBe(0)
  })

  it("subscribes to the new source once the deps change, and unsubscribes from the old one", () => {
    const first = countSubscriptions(new BehaviorSubject(1))
    const second = countSubscriptions(new BehaviorSubject(2))

    function Observer({ source }: { source: "first" | "second" }) {
      "use no memo"
      const { data } = useObserve(
        () => (source === "first" ? first.counted$ : second.counted$),
        [source],
      )

      return <>{data}</>
    }

    const { rerender, container } = render(<Observer source="first" />)

    rerender(<Observer source="second" />)

    expect(container.textContent).toBe("2")
    expect(first.subscriptions).toEqual({ made: 1, open: 0 })
    expect(second.subscriptions).toEqual({ made: 1, open: 1 })
  })

  it("renders the value of a BehaviorSubject on the first render, and renders once", () => {
    const statuses: string[] = []
    const source$ = new BehaviorSubject("value")

    function Observer() {
      "use no memo"
      const { data, status } = useObserve(source$)
      statuses.push(`${status}:${data}`)

      return null
    }

    render(<Observer />)

    expect(statuses).toEqual(["success:value"])
  })
})

describe("Given an observable created during render", () => {
  it("makes React throw Too many re-renders once the component renders again", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const caught: unknown[] = []
    const subject = new BehaviorSubject(1)

    class Boundary extends Component<
      { children: ReactNode },
      { hasError: boolean }
    > {
      state = { hasError: false }

      static getDerivedStateFromError() {
        return { hasError: true }
      }

      componentDidCatch(error: unknown) {
        caught.push(error)
      }

      render() {
        return this.state.hasError ? null : this.props.children
      }
    }

    function Observer() {
      "use no memo"
      const { data } = useObserve(subject.pipe(map((value) => value * 2)))

      return <>{data}</>
    }

    render(
      <Boundary>
        <Observer />
      </Boundary>,
    )

    expect(caught).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("Too many re-renders"),
      }),
    ])
  })
})

describe("Given a render that React throws away", () => {
  it("subscribes to nothing for a mount that a Suspense boundary threw away", async () => {
    const { counted$, subscriptions } = countSubscriptions(
      new BehaviorSubject(1),
    )
    const { promise, resolve } = createPendingPromise()

    function Suspends() {
      "use no memo"
      use(promise)

      return null
    }

    function Observer() {
      "use no memo"
      useObserve(counted$)

      return null
    }

    const { unmount } = await act(async () =>
      render(
        <Suspense fallback={null}>
          <Observer />
          <Suspends />
        </Suspense>,
      ),
    )

    expect(subscriptions.made).toBe(0)

    await act(async () => {
      resolve()
      await promise
    })

    expect(subscriptions).toEqual({ made: 1, open: 1 })

    unmount()

    expect(subscriptions.open).toBe(0)
  })

  it("subscribes to nothing for a render that an error boundary caught", () => {
    const { counted$, subscriptions } = countSubscriptions(
      new BehaviorSubject(1),
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    function Throws(): ReactNode {
      "use no memo"
      useObserve(counted$)

      throw new Error("render failed")
    }

    render(
      <CatchError>
        <Throws />
      </CatchError>,
    )

    expect(subscriptions.made).toBe(0)
  })

  it("subscribes to nothing for the render of a transition that React abandoned", async () => {
    const sources = [1, 2, 3].map((value) =>
      countSubscriptions(new BehaviorSubject(value)),
    )
    const pending = createPendingPromise()
    let setStep = (_step: number) => {}

    function Suspends({ step }: { step: number }) {
      "use no memo"
      if (step === 1) use(pending.promise)

      return null
    }

    function Observer() {
      "use no memo"
      const [step, setStepState] = useState(0)
      setStep = setStepState

      const { data } = useObserve(() => sources[step]?.counted$, [step])

      return (
        <>
          {data}
          <Suspends step={step} />
        </>
      )
    }

    const { unmount, container } = render(
      <Suspense fallback={null}>
        <Observer />
      </Suspense>,
    )

    await act(async () => {
      startTransition(() => setStep(1))
    })
    await act(async () => {
      setStep(2)
    })

    expect(container.textContent).toBe("3")
    expect(sources.map(({ subscriptions }) => subscriptions)).toEqual([
      { made: 1, open: 0 },
      { made: 0, open: 0 },
      { made: 1, open: 1 },
    ])

    unmount()
  })

  it("subscribes to nothing for a mount in a hidden Activity, until it shows", async () => {
    const { counted$, subscriptions } = countSubscriptions(
      new BehaviorSubject(1),
    )

    function Observer() {
      "use no memo"
      useObserve(counted$)

      return null
    }

    const App = ({ mode }: { mode: "visible" | "hidden" }) => (
      <Activity mode={mode}>
        <Observer />
      </Activity>
    )

    const { rerender, unmount } = await act(async () =>
      render(<App mode="hidden" />),
    )

    expect(subscriptions.made).toBe(0)

    await act(async () => {
      rerender(<App mode="visible" />)
    })

    expect(subscriptions).toEqual({ made: 1, open: 1 })

    unmount()

    expect(subscriptions.open).toBe(0)
  })
})

describe("Given a transition that suspends, then an unrelated urgent render", () => {
  it("keeps the committed subscription, and subscribes once to the source of the transition", async () => {
    const sources = [0, 1].map((value) =>
      countSubscriptions(new BehaviorSubject(value)),
    )
    const pending = createPendingPromise()
    let setStep = (_step: number) => {}
    let setUnrelated = (_value: number) => {}

    function Suspends({ step }: { step: number }) {
      "use no memo"
      if (step === 1) use(pending.promise)

      return null
    }

    function Observer() {
      "use no memo"
      const [step, setStepState] = useState(0)
      const [unrelated, setUnrelatedState] = useState(0)
      setStep = setStepState
      setUnrelated = setUnrelatedState

      const { data } = useObserve(() => sources[step]?.counted$, [step])

      return (
        <>
          {`${data}:${unrelated}`}
          <Suspends step={step} />
        </>
      )
    }

    const { container, unmount } = render(
      <Suspense fallback={null}>
        <Observer />
      </Suspense>,
    )

    await act(async () => {
      startTransition(() => setStep(1))
    })
    await act(async () => {
      setUnrelated(1)
    })

    expect(container.textContent).toBe("0:1")

    await act(async () => {
      pending.resolve()
      await pending.promise
    })

    expect(container.textContent).toBe("1:1")
    expect(sources.map(({ subscriptions }) => subscriptions)).toEqual([
      { made: 1, open: 0 },
      { made: 1, open: 1 },
    ])

    unmount()
  })
})

describe("Given deps that leave a source, then come back to it", () => {
  it("subscribes again to a source that completed", () => {
    const a = countSubscriptions(of("a"))
    const b$ = new BehaviorSubject("b")

    function Observer({ which }: { which: "a" | "b" }) {
      "use no memo"
      const { data, status } = useObserve(
        () => (which === "a" ? a.counted$ : b$),
        [which],
      )

      return <>{`${status}:${data}`}</>
    }

    const { rerender, container } = render(<Observer which="a" />)

    expect(container.textContent).toBe("success:a")

    rerender(<Observer which="b" />)
    act(() => {
      b$.next("b2")
    })
    rerender(<Observer which="a" />)

    expect(container.textContent).toBe("success:a")
    expect(a.subscriptions.made).toBe(2)
  })

  it("subscribes again when the factory returns the same observable for new deps", () => {
    const { counted$, subscriptions } = countSubscriptions(of(1))

    function Observer({ attempt }: { attempt: number }) {
      "use no memo"
      useObserve(() => counted$, [attempt])

      return null
    }

    const { rerender } = render(<Observer attempt={0} />)

    rerender(<Observer attempt={1} />)

    expect(subscriptions.made).toBe(2)
  })
})

describe("Given a source with a value, then a source without one", () => {
  it("is pending for the new source", () => {
    const first$: Observable<string> = new BehaviorSubject("first")
    const second$ = new Subject<string>()

    const { result, rerender } = renderHook(
      ({ source }) => useObserve(source),
      { initialProps: { source: first$ } },
    )

    rerender({ source: second$ })

    expect(result.current).toMatchObject({ status: "pending", data: undefined })
  })
})

describe("Given a BehaviorSubject whose value changes between render and subscription", () => {
  it("shows the new value", () => {
    const subject = new BehaviorSubject(1)

    function ChangesTheValue() {
      "use no memo"
      useLayoutEffect(() => {
        subject.next(2)
      }, [])

      return null
    }

    function Observer() {
      "use no memo"
      const { data } = useObserve(subject)

      return (
        <>
          {data}
          <ChangesTheValue />
        </>
      )
    }

    const { container } = render(<Observer />)

    expect(container.textContent).toBe("2")
  })
})

describe("Given a closed BehaviorSubject", () => {
  it("returns an error without throwing, on the first render", () => {
    const subject = new BehaviorSubject(1)
    subject.unsubscribe()
    const statuses: string[] = []

    const { result } = renderHook(() => {
      const value = useObserve(subject)
      statuses.push(value.status)

      return value
    })

    expect(statuses).toEqual(["error"])
    expect(result.current.error).toBeInstanceOf(ObjectUnsubscribedError)
  })
})

describe("Given a Suspense boundary that suspends again", () => {
  it("keeps the subscription while its content is hidden", async () => {
    const { counted$, subscriptions } = countSubscriptions(new Subject())
    const pending = createPendingPromise()
    let suspend = (_shouldSuspend: boolean) => {}

    function Suspends({ shouldSuspend }: { shouldSuspend: boolean }) {
      "use no memo"
      if (shouldSuspend) use(pending.promise)

      return null
    }

    function Observer() {
      "use no memo"
      useObserve(counted$)

      return null
    }

    function App() {
      "use no memo"
      const [shouldSuspend, setShouldSuspend] = useState(false)
      suspend = setShouldSuspend

      return (
        <Suspense fallback={null}>
          <Observer />
          <Suspends shouldSuspend={shouldSuspend} />
        </Suspense>
      )
    }

    render(<App />)

    expect(subscriptions).toEqual({ made: 1, open: 1 })

    await act(async () => {
      suspend(true)
    })

    expect(subscriptions).toEqual({ made: 1, open: 1 })

    await act(async () => {
      pending.resolve()
      await pending.promise
    })

    expect(subscriptions).toEqual({ made: 1, open: 1 })
  })
})

describe("Given a source that completes, and React runs the effect again", () => {
  it("subscribes once under StrictMode", () => {
    const { counted$, subscriptions } = countSubscriptions(of(1))

    const { result } = renderHook(() => useObserve(counted$), {
      wrapper: StrictMode,
    })

    expect(result.current.data).toBe(1)
    expect(subscriptions.made).toBe(1)
  })

  it("subscribes once when an Activity shows the component again", async () => {
    const { counted$, subscriptions } = countSubscriptions(of(1))

    function Observer() {
      "use no memo"
      const { data } = useObserve(counted$)

      return <>{data}</>
    }

    const App = ({ mode }: { mode: "visible" | "hidden" }) => (
      <Activity mode={mode}>
        <Observer />
      </Activity>
    )

    const { rerender, container } = render(<App mode="visible" />)

    await act(async () => {
      rerender(<App mode="hidden" />)
    })
    await act(async () => {
      rerender(<App mode="visible" />)
    })

    expect(container.textContent).toBe("1")
    expect(subscriptions.made).toBe(1)
  })
})

describe("Given a defaultValue written inline", () => {
  it("returns the same result across renders while the source has a value", () => {
    const source$ = concat(of(1), NEVER)

    const { result, rerender } = renderHook(() =>
      useObserve(source$, { defaultValue: [] as number[] }),
    )

    const resultWithAValue = result.current
    rerender()

    expect(resultWithAValue.status).toBe("success")
    expect(result.current).toBe(resultWithAValue)
  })
})
