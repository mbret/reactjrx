/// <reference types="vitest/config" />
import { builtinModules } from "node:module"
import { resolve } from "node:path"
import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import pkg from "./package.json" with { type: "json" }

// Replicates the behaviour of the former rollup-plugin-node-externals
// (peerDeps/deps/devDeps/optionalDeps + builtins), which is incompatible with
// vite 8's rolldown bundler: externalize node built-ins (with or without the
// "node:" prefix) and every package declared in package.json, plus their
// subpaths (e.g. "react/jsx-runtime"). Only declared packages are externalized
// — an undeclared bare import is left to the bundler exactly as before.
const externalPackages = [
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const externalPattern = new RegExp(
  `^(?:${externalPackages.map(escapeRegExp).join("|")})(?:/.+)?$`,
)
const builtins = new Set(builtinModules)
const isExternal = (id: string) =>
  builtins.has(id.replace(/^node:/, "")) || externalPattern.test(id)

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    dts({
      entryRoot: "src",
      // One self-contained `index.d.ts`. Node's ES module resolution does
      // not follow the extensionless paths of per-file declarations.
      bundleTypes: {
        // TypeScript 7 no longer ships lib typings in `typescript/lib`, which
        // is where the plugin tells api-extractor to look. Unset it so
        // api-extractor uses the libs of its own bundled compiler.
        invokeOptions: { typescriptCompilerFolder: undefined },
      },
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
      entry: resolve(import.meta.dirname, "src/index.ts"),
      name: pkg.name,
      // the proper extensions will be added
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: isExternal,
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
