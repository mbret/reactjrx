import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"

// https://testing-library.com/docs/react-testing-library/api#cleanup
afterEach(() => cleanup())
