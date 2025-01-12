import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SIGNAL_RESET } from "./constants";
import { useSignalValue } from "./react/useSignalValue";
import { signal } from "./signal";

describe("signal", () => {
  describe("Given a number signal with default value", () => {
    it("should reset to default value", () => {
      const state = signal({ default: 5 });

      const { result, rerender } = renderHook(() => {
        return useSignalValue(state);
      }, {});

      expect(result.current).toBe(5);

      state.setValue(6);

      rerender();

      expect(result.current).toBe(6);

      state.setValue(SIGNAL_RESET);

      rerender();

      expect(result.current).toBe(5);
    });
  });

  describe("Given a number signal with non default value", () => {
    it("should reset to undefined", () => {
      const state = signal<number | undefined>({});

      const { result, rerender } = renderHook(() => {
        return useSignalValue(state);
      }, {});

      expect(result.current).toBe(undefined);

      state.setValue(6);

      rerender();

      expect(result.current).toBe(6);

      state.setValue(SIGNAL_RESET);

      rerender();

      expect(result.current).toBe(undefined);
    });
  });

  describe("Given a signal with a get config", () => {
    it("signal b should return value of signal a", () => {
      const signalA = signal({ default: 5 });
      const signalB = signal({
        get: (get) => get(signalA),
      });

      expect(signalB.getValue()).toBe(5);
    });

    it("should update signal b after signal a update", () => {
      const signalA = signal({ default: 5 });
      const signalB = signal({
        get: (get) => get(signalA),
      });

      signalA.setValue(1);

      expect(signalB.getValue()).toBe(1);
    });

    describe("and the getter use a different signal on subsequent iterations", () => {
      it("should update signal c after signal b update, not a", () => {
        let iterationNumber = 0;
        let callsToGet = 0;
        const signalA = signal({ default: 5 });
        const signalB = signal({ default: 10 });
        const signalC = signal({
          get: (get) => {
            callsToGet++;
            if (iterationNumber === 0) {
              iterationNumber++;
              return get(signalA);
            }

            return get(signalB);
          },
        });

        expect(signalC.getValue()).toBe(5);

        signalA.setValue(1);

        expect(signalC.getValue()).toBe(10);

        expect(callsToGet).toBe(2);

        // signalA is not tracked so getter is not called again
        signalA.setValue(1);

        expect(callsToGet).toBe(2);
      });
    });
  });
});
