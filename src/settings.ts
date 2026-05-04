import type { BlogPushSettings } from "./types";

export const DEFAULT_SETTINGS: BlogPushSettings = {
	githubTokenSecret: "",
	owner: "shiomiyan",
	repo: "blog",
	pushBranch: "obsidian",
	baseBranch: "master",
	postsDirectory: "src/content/posts",
};
