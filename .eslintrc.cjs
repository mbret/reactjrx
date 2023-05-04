module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ["plugin:react/recommended", "standard-with-typescript", "prettier"],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "./tsconfig.json"
  },
  plugins: ["react"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": 0,
    "react/display-name": 0,
    "@typescript-eslint/no-invalid-void-type": 0,
    "react/react-in-jsx-scope": 0,
    "@typescript-eslint/triple-slash-reference": 0,
    "@typescript-eslint/strict-boolean-expressions": 0
  }
}
