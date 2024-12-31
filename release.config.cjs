module.exports = {
	branches: ["main"],
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		// https://github.com/semantic-release/semantic-release/issues/2204#issuecomment-1486299917
		[
			"@semantic-release/github",
			{
				successComment: false,
				failTitle: false,
			},
		],
		"@semantic-release/npm",
	],
};
