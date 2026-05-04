import { getFrontMatterInfo, parseYaml, stringifyYaml } from "obsidian";
import {
	FrontmatterError,
	REQUIRED_FRONTMATTER_KEYS,
	validateFrontmatter,
	type RequiredFrontmatterKey,
} from "./validation";
import type { BlogPostContent } from "../types";

export { fillPostMetadata, type FilledPostMetadata } from "./metadata";
export { FrontmatterError } from "./validation";

export function parsePostContent(source: string): BlogPostContent {
	const info = getFrontMatterInfo(source);
	if (!info.exists) {
		throw new FrontmatterError("Missing frontmatter.", [...REQUIRED_FRONTMATTER_KEYS]);
	}

	const body = source.slice(info.contentStart);
	const parsed = parseYaml(info.frontmatter) as Partial<
		Record<RequiredFrontmatterKey, unknown>
	> | null;
	const data = parsed ?? {};
	const missing = REQUIRED_FRONTMATTER_KEYS.filter(
		(key) => data[key] === undefined || data[key] === null,
	);
	if (missing.length > 0) {
		throw new FrontmatterError(`Missing frontmatter: ${missing.join(", ")}`, missing);
	}

	const frontmatter = validateFrontmatter(data);
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
		category: post.frontmatter.category,
		tags: post.frontmatter.tags,
	};

	return `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n${body}`;
}
