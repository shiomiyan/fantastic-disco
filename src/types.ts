import type { BlogFrontmatter } from "./frontmatter/schema";

export interface BlogPostContent {
	frontmatter: BlogFrontmatter;
	body: string;
	source: string;
}

export interface PreparedAsset {
	sourcePath: string;
	targetFilename: string;
	targetPath: string;
	data: ArrayBuffer;
	size: number;
}

export interface PreparedPost {
	frontmatter: Omit<BlogFrontmatter, "slug">;
	slug: string;
	markdown: string;
	postDirectory: string;
	indexPath: string;
	assets: PreparedAsset[];
}

export interface PushSummary {
	commitSha?: string;
	commitUrl?: string;
	changedFiles: number;
	deletedImages: number;
	warnings: string[];
	dryRun: boolean;
}

export interface PullSummary {
	updated: boolean;
	indexPath: string;
	dryRun: boolean;
}
