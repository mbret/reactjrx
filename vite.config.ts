import { resolve } from "path"
import { defineConfig } from "vite"
import { name } from "./package.json"
import dts from "vite-plugin-dts"
import { externals } from "rollup-plugin-node-externals"

export default defineConfig({
  plugins: [
    {
      enforce: "pre",
      ...externals({
        peerDeps: true,
        deps: true,
        devDeps: true,
        /**
         * We are letting cryptojs being bundled here because it bugs when
         * letting consumer package include it
         */
        exclude: "cryptojs"
      })
    },
    dts()
  ],
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/index.ts"),
      name,
      // the proper extensions will be added
      fileName: "index",
      formats: ["es", "cjs"]
    },
    // handled by consumer
    minify: false
  }
})
