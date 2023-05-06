module.exports = {
  branches: ["main"],
  plugins: [
    [
      // https://github.com/semantic-release/semantic-release/issues/2204#issuecomment-1486299917
      "@semantic-release/github",
      {
        // successComment: false,
        // failTitle: false
      }
    ]
  ]
}
