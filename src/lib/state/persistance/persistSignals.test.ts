import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import { waitForTimeout } from "../../../tests/utils";
import { signal } from "../signal";
import { MockAdapter } from "./adapters/MockAdapter";
import { IDENTIFIER_PERSISTANCE_KEY } from "./constants";
import { persistSignals } from "./persistSignals";
import type { PersistanceEntry } from "./types";

describe("Given a storage that never resolves", () => {
  it("should not hydrate", async () => {
    const mockAdapter = new MockAdapter({}, { resolve: false });
    const mySignal = signal({ default: 0, key: "key" });

    const persistance$ = persistSignals({
      entries: [{ signal: mySignal, version: 0 }],
      adapter: mockAdapter,
    });

    const value = await Promise.race([
      firstValueFrom(persistance$),
      waitForTimeout(100),
    ]);

    expect(value).toBe(undefined);
  });
});

describe("Given an empty storage", () => {
  it("should hydrate but not overwrite", async () => {
    const mockAdapter = new MockAdapter({});
    const mySignal = signal({ default: 0, key: "key" });

    const persistance$ = persistSignals({
      entries: [{ signal: mySignal, version: 0 }],
      adapter: mockAdapter,
    });

    const value = await firstValueFrom(persistance$);

    expect(value).toEqual({ type: "hydrated" });
    expect(mySignal.getValue()).toEqual(0);
  });
});

describe("Given an invalid stored value", () => {
  it("should hydrate but not overwrite", async () => {
    const mockAdapter = new MockAdapter({ key: 5 });
    const mySignal = signal({ default: 0, key: "key" });

    const persistance$ = persistSignals({
      entries: [{ signal: mySignal, version: 0 }],
      adapter: mockAdapter,
    });

    await firstValueFrom(persistance$);

    expect(mySignal.getValue()).toEqual(0);
  });
});

describe("Given a valid stored value", () => {
  it("should hydrate and overwrite", async () => {
    const mockAdapter = new MockAdapter({
      key: {
        [IDENTIFIER_PERSISTANCE_KEY]: IDENTIFIER_PERSISTANCE_KEY,
        value: 5,
        migrationVersion: 0,
      } satisfies PersistanceEntry,
    });
    const mySignal = signal({ default: 0, key: "key" });

    const persistance$ = persistSignals({
      entries: [{ signal: mySignal, version: 0 }],
      adapter: mockAdapter,
    });

    await firstValueFrom(persistance$);

    expect(mySignal.getValue()).toEqual(5);
  });
});

describe("Given a new signal version", () => {
  describe("when a storage value already exist with no version", () => {
    it("should hydrate and not overwrite", async () => {
      const mockAdapter = new MockAdapter({
        key: {
          [IDENTIFIER_PERSISTANCE_KEY]: IDENTIFIER_PERSISTANCE_KEY,
          value: 5,
        } satisfies PersistanceEntry,
      });
      const mySignal = signal({ default: 0, key: "key" });

      const persistance$ = persistSignals({
        entries: [{ signal: mySignal, version: 0 }],
        adapter: mockAdapter,
      });

      await firstValueFrom(persistance$);

      expect(mySignal.getValue()).toEqual(0);
    });
  });

  describe("when a storage value already exist with inferior version", () => {
    it("should hydrate and overwrite", async () => {
      const mockAdapter = new MockAdapter({
        key: {
          [IDENTIFIER_PERSISTANCE_KEY]: IDENTIFIER_PERSISTANCE_KEY,
          value: 5,
          migrationVersion: 1,
        } satisfies PersistanceEntry,
      });
      const mySignal = signal({ default: 0, key: "key" });

      const persistance$ = persistSignals({
        entries: [{ signal: mySignal, version: 2 }],
        adapter: mockAdapter,
      });

      await firstValueFrom(persistance$);

      expect(mySignal.getValue()).toEqual(0);
    });
  });

  describe("when a storage value already exist with superior version", () => {
    it("should hydrate and overwrite", async () => {
      const mockAdapter = new MockAdapter({
        key: {
          [IDENTIFIER_PERSISTANCE_KEY]: IDENTIFIER_PERSISTANCE_KEY,
          value: 5,
          migrationVersion: 3,
        } satisfies PersistanceEntry,
      });
      const mySignal = signal({ default: 0, key: "key" });

      const persistance$ = persistSignals({
        entries: [{ signal: mySignal, version: 2 }],
        adapter: mockAdapter,
      });

      await firstValueFrom(persistance$);

      expect(mySignal.getValue()).toEqual(5);
    });
  });
});
