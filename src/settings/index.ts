import { blogPushSettingsSchema, type BlogPushSettings } from "./schema";

export const DEFAULT_SETTINGS: BlogPushSettings = {
	githubTokenSecret: "",
	owner: "shiomiyan",
	repo: "blog",
	pushBranch: "obsidian",
	baseBranch: "master",
	postsDirectory: "src/content/posts",
};

export function normalizeSettings(data: unknown): BlogPushSettings {
	return blogPushSettingsSchema.parse({
		...DEFAULT_SETTINGS,
		...(isRecord(data) ? data : {}),
	});
}

export type { BlogPushSettings } from "./schema";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
