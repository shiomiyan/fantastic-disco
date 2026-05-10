import { getFrontMatterInfo, parseYaml, stringifyYaml } from "obsidian";
import { validateFrontmatter } from "./schema";
import type { BlogPostContent } from "../types";

export { fillFrontmatter, type FillFrontmatterResult } from "./fill";

export function parsePostContent(source: string): BlogPostContent {
	const info = getFrontMatterInfo(source);
	if (!info.exists) {
		throw new Error("Missing frontmatter.");
	}

	const body = source.slice(info.contentStart);
	const frontmatter = validateFrontmatter(parseYaml(info.frontmatter));
	return {
		frontmatter,
		body,
		source,
	};
}

export function buildBlogMarkdown(post: BlogPostContent, body: string): string {
	const frontmatter = {
		title: post.frontmatter.title,
		description: post.frontmatter.description,
		created: post.frontmatter.created,
		draft: post.frontmatter.draft,
		id: post.frontmatter.id,
		categories: post.frontmatter.categories,
		tags: post.frontmatter.tags,
	};

	return `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n${body}`;
}
