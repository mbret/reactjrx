// @ts-check

/** @type {import('eslint').Linter.Config} */
const config = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "tsconfig.json"
  },
  plugins: ["react"],
  ignorePatterns: ["vitest.config.ts", "vite.config.ts", "test-setup.ts"],
  rules: {
    "react/jsx-key": ["error", { checkFragmentShorthand: true }],
    "react-hooks/exhaustive-deps": "error",
    "@typescript-eslint/explicit-function-return-type": 0,
    "react/display-name": 0,
    "@typescript-eslint/no-invalid-void-type": 0,
    "react/react-in-jsx-scope": 0,
    "@typescript-eslint/triple-slash-reference": 0,
    "@typescript-eslint/strict-boolean-expressions": 0,
    "@typescript-eslint/no-unsafe-argument": 0,
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn"
  }
}

module.exports = config
