import { defineConfig } from "oxlint";

export default defineConfig({
	categories: {
		correctness: "error",
		suspicious: "error",
		perf: "warn",
	},
	plugins: ["typescript", "import", "node", "oxc"],
	env: {
		browser: true,
		es2022: true,
		node: true,
	},
	rules: {
		"no-new": "off",
		"no-await-in-loop": "off",
	},
	ignorePatterns: [
		"node_modules",
		"dist",
		"main.js",
		"versions.json",
		"version-bump.mjs",
		"rolldown.config.mjs",
	],
});
