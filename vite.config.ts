/// <reference types="vitest/config" />
import { isAbsolute, resolve } from "node:path"
import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import { name } from "./package.json"

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    dts({
      entryRoot: "src",
    }),
  ],
  build: {
    minify: "terser",
    terserOptions: {
      format: {
        comments: false,
        preserve_annotations: true,
      },
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/index.ts"),
      name,
      // the proper extensions will be added
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Externalize node built-ins and every third-party package (all deps
      // are peer deps) so the library bundles only its own source. Anything
      // that is not a relative or absolute path is treated as external.
      external: (id) => !id.startsWith(".") && !isAbsolute(id),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["test-setup.ts"],
    testTimeout: 500,
  },
})
