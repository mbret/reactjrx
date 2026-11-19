/// <reference types="vitest/config" />
import { copyFileSync } from "node:fs"
import { builtinModules, createRequire } from "node:module"
import { dirname, resolve } from "node:path"
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
      bundleTypes: {
        invokeOptions: {
          // `typescript` is the native port and ships no lib files that
          // api-extractor can follow; give it the JS compiler instead.
          typescriptCompilerFolder: dirname(
            createRequire(import.meta.url).resolve(
              "@typescript/old/package.json",
            ),
          ),
        },
      },
    }),
    {
      name: "cjs-types",
      // The `require` condition resolves types next to `index.cjs`, so the
      // bundled declarations are also emitted as `index.d.cts`.
      closeBundle() {
        copyFileSync(
          resolve(import.meta.dirname, "dist/index.d.ts"),
          resolve(import.meta.dirname, "dist/index.d.cts"),
        )
      },
    },
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
      formats: ["es", "cjs"],
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
