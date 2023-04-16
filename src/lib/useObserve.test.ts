import { describe, expect, it } from "vitest";
import { Subject, map, of, timer } from "rxjs";
import { useObserve } from "./useObserve";
import { act, renderHook } from "@testing-library/react";

describe("useObserve", () => {
  it("should return undefined before subscription", async () => {
    /**
     * @important
     * Because renderHook use act inside, the first returned value
     * is usually not the first render. We would not catch the undefined
     * value if we did not intentionally wait for next tick.
     */
    const source$ = timer(1).pipe(map(() => 123));

    const { result } = renderHook(() => useObserve(source$), {});

    expect(result.current).toBe(undefined);

    await new Promise((resolve) => setTimeout(resolve, 1));

    expect(result.current).toBe(123);
  });

  it("should return custom default value", async ({ expect }) => {
    const source$ = new Subject<number>();

    const { result } = renderHook(
      () => useObserve(source$, { defaultValue: null }),
      {}
    );

    expect(result.current).toBe(null);
  });

  it("should return the value after subscription", async ({ expect }) => {
    const source$ = of(123);

    const { result } = renderHook(() => useObserve(source$), {});

    await new Promise((resolve) => setTimeout(resolve, 1));

    expect(result.current).toBe(123);
  });

  it("should return new value after a stream change", async ({ expect }) => {
    const source$ = new Subject<number>();

    const { result } = renderHook(() => useObserve(source$), {});

    await new Promise((resolve) => setTimeout(resolve, 1));

    expect(result.current).toBe(undefined);

    act(() => {
      source$.next(0);
    });

    expect(result.current).toBe(0);

    act(() => {
      source$.next(1);
    });

    expect(result.current).toBe(1);
  });
});
