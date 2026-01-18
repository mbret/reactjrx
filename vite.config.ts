/// <reference types="vitest/config" />
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import externals from "rollup-plugin-node-externals"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import { name } from "./package.json"

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    {
      enforce: "pre",
      ...externals({
        peerDeps: true,
        deps: true,
        devDeps: true,
      }),
    },
    dts(),
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
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["test-setup.ts"],
    testTimeout: 500,
  },
})
