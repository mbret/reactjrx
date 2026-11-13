// @vitest-environment node
import { renderToString } from "react-dom/server"
import { BehaviorSubject, concat, NEVER, of } from "rxjs"
import { describe, expect, it } from "vitest"
import { countSubscriptions } from "../../../tests/liveQuery"
import { useObserve } from "./useObserve"

describe("Given a server render", () => {
  it("renders the value of a BehaviorSubject without subscribing to it", () => {
    const subject = new BehaviorSubject(1)

    function Observer() {
      "use no memo"
      const { data } = useObserve(subject)

      return <>{data}</>
    }

    expect(renderToString(<Observer />)).toBe("1")
    expect(subject.observed).toBe(false)
  })

  it("renders the default value of a source that holds no value, without subscribing to it", () => {
    const { counted$, subscriptions } = countSubscriptions(
      concat(of("first"), NEVER),
    )

    function Observer() {
      "use no memo"
      const { data, status } = useObserve(counted$, { defaultValue: "none" })

      return <>{`${status}:${data}`}</>
    }

    expect(renderToString(<Observer />)).toBe("pending:none")
    expect(subscriptions.made).toBe(0)
  })
})
