import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    react({
      babel: {
        // plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["test-setup.ts"],
    testTimeout: 500,
  },
})
