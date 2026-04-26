import {parseYaml, stringifyYaml} from "obsidian";
import {BlogFrontmatter, BlogPostContent} from "./types";

const REQUIRED_KEYS = [
	"title",
	"description",
	"created",
	"draft",
	"id",
	"category",
	"tags",
	"slug",
] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

export class FrontmatterError extends Error {
	constructor(message: string, public readonly details: string[] = []) {
		super(message);
	}
}

export function ensurePostId(source: string): {source: string; generatedId: string | null} {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
	if (!match) {
		return {
			source,
			generatedId: null,
		};
	}

	const rawFrontmatter = match[1] ?? "";
	if (/^id\s*:/m.test(rawFrontmatter)) {
		return {
			source,
			generatedId: null,
		};
	}

	const generatedId = crypto.randomUUID();
	const lines = rawFrontmatter.split(/\r?\n/);
	const draftIndex = lines.findIndex((line) => /^draft\s*:/.test(line));
	const insertIndex = draftIndex >= 0 ? draftIndex + 1 : lines.length;
	lines.splice(insertIndex, 0, `id: ${generatedId}`);

	return {
		source: `---\n${lines.join("\n")}\n---\n${match[2] ?? ""}`,
		generatedId,
	};
}

export function parsePostContent(source: string): BlogPostContent {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
	if (!match) {
		throw new FrontmatterError("Missing frontmatter.", [...REQUIRED_KEYS]);
	}

	const rawFrontmatter = match[1] ?? "";
	const body = match[2] ?? "";
	const parsed = parseYaml(rawFrontmatter) as Partial<Record<RequiredKey, unknown>> | null;
	const data = parsed ?? {};
	const missing = REQUIRED_KEYS.filter((key) => data[key] === undefined || data[key] === null);
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

function validateFrontmatter(data: Partial<Record<RequiredKey, unknown>>): BlogFrontmatter {
	const errors: string[] = [];
	const title = requireString(data.title, "title", errors);
	const description = requireString(data.description, "description", errors);
	const created = requireCreated(data.created, errors);
	const draft = requireBoolean(data.draft, "draft", errors);
	const id = requireString(data.id, "id", errors);
	const category = requireString(data.category, "category", errors);
	const tags = requireTags(data.tags, errors);
	const slug = requireSlug(data.slug, errors);

	if (errors.length > 0) {
		throw new FrontmatterError(`Invalid frontmatter: ${errors.join(", ")}`, errors);
	}

	return {
		title,
		description,
		created,
		draft,
		id,
		category,
		tags,
		slug,
	};
}

function requireString(value: unknown, key: string, errors: string[]): string {
	if (typeof value !== "string") {
		errors.push(`${key} must be a string`);
		return "";
	}
	if (value.trim() === "") {
		errors.push(`${key} must not be empty`);
	}
	return value;
}

function requireSlug(value: unknown, errors: string[]): string {
	const slug = requireString(value, "slug", errors);
	if (slug.match(/[^a-zA-Z0-9/_-]/)) {
		errors.push("slug may only contain letters, numbers, slash, underscore, and hyphen");
	}
	if (slug.startsWith("/") || slug.endsWith("/") || slug.includes("..")) {
		errors.push("slug must be a relative post directory");
	}
	return slug;
}

function requireCreated(value: unknown, errors: string[]): string {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			errors.push("created must be a valid date");
		}
		return value.toISOString();
	}
	if (typeof value !== "string") {
		errors.push("created must be a date string");
		return "";
	}
	if (Number.isNaN(new Date(value).getTime())) {
		errors.push("created must be a valid date string");
	}
	return value;
}

function requireBoolean(value: unknown, key: string, errors: string[]): boolean {
	if (typeof value !== "boolean") {
		errors.push(`${key} must be a boolean`);
		return false;
	}
	return value;
}

function requireTags(value: unknown, errors: string[]): string[] {
	if (!Array.isArray(value)) {
		errors.push("tags must be an array");
		return [];
	}

	const tags: string[] = [];
	for (const tag of value) {
		if (typeof tag !== "string") {
			errors.push("tags must contain only strings");
			continue;
		}
		tags.push(tag);
	}
	return tags;
}
