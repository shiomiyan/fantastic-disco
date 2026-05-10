import { getFrontMatterInfo, parseYaml, stringifyYaml } from "obsidian";
import { validateFrontmatter } from "./schema";
import type { BlogPostContent } from "../types";

export { CategoryNormalizationError } from "./categories";
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

export function readFrontmatter(source: string): Record<string, unknown> {
	const info = getFrontMatterInfo(source);
	if (!info.exists) {
		throw new Error("Missing frontmatter.");
	}

	const parsed = parseYaml(info.frontmatter);
	if (!isRecord(parsed)) {
		throw new Error("Frontmatter must be a YAML object.");
	}

	return parsed;
}

export function replaceFrontmatter(
	source: string,
	transform: (frontmatter: Record<string, unknown>) => Record<string, unknown>,
): string {
	const info = getFrontMatterInfo(source);
	if (!info.exists) {
		throw new Error("Missing frontmatter.");
	}

	const updated = transform(readFrontmatter(source));
	return `---\n${stringifyYaml(updated).trimEnd()}\n---\n${source.slice(info.contentStart)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
