import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

// https://testing-library.com/docs/react-testing-library/api#cleanup
afterEach(async () => {
  cleanup()

  /**
   * TanStack Query hands observer updates to React through a 0 ms timer. Let
   * the ones queued before the unmount run while jsdom's `window` still
   * exists: Vitest can tear the environment down before that timer fires, and
   * React then throws "window is not defined".
   */
  await new Promise((resolve) => setTimeout(resolve, 0))
})
