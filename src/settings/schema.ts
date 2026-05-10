import { z } from "zod";

export const blogPushSettingsSchema = z.object({
	githubTokenSecret: z.string(),
	owner: z.string(),
	repo: z.string(),
	pushBranch: z.string(),
	baseBranch: z.string(),
	postsDirectory: z.string(),
});

export type BlogPushSettings = z.infer<typeof blogPushSettingsSchema>;
