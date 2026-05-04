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

export interface FilledPostMetadata {
	source: string;
	generatedId: string | null;
	generatedSlug: string | null;
}

export function fillPostMetadata(source: string, fallbackBasename: string): FilledPostMetadata {
	const generatedId = crypto.randomUUID();
	const generatedSlug = generateSlug(source, fallbackBasename);
	const match = source.match(/^(---)(\r?\n)([\s\S]*?)(\r?\n)---(?:\r?\n)?([\s\S]*)$/);

	if (!match) {
		return {
			source: `---\nid: ${generatedId}\nslug: ${generatedSlug}\n---\n${source}`,
			generatedId,
			generatedSlug,
		};
	}

	const lineEnding = match[2] ?? "\n";
	const rawFrontmatter = match[3] ?? "";
	const body = match[5] ?? "";
	const lines = rawFrontmatter.split(/\r?\n/);
	const idResult = ensureFrontmatterValue(lines, "id", generatedId, findInsertionIndex(lines, "draft"));
	const slugResult = ensureFrontmatterValue(lines, "slug", generatedSlug, findInsertionIndex(lines, "tags"));
	const nextSource = `---${lineEnding}${lines.join(lineEnding)}${lineEnding}---${lineEnding}${body}`;

	return {
		source: nextSource,
		generatedId: idResult.changed ? generatedId : null,
		generatedSlug: slugResult.changed ? generatedSlug : null,
	};
}

function ensureFrontmatterValue(
	lines: string[],
	key: string,
	value: string,
	insertIndex: number,
): {changed: boolean} {
	const existingIndex = lines.findIndex((line) => new RegExp(`^${key}\\s*:`).test(line));
	if (existingIndex >= 0) {
		const line = lines[existingIndex] ?? "";
		const currentValue = line.slice(line.indexOf(":") + 1).trim();
		if (!isEmptyFrontmatterValue(currentValue)) {
			return {
				changed: false,
			};
		}

		lines[existingIndex] = `${key}: ${value}`;
		return {
			changed: true,
		};
	}

	lines.splice(insertIndex, 0, `${key}: ${value}`);
	return {
		changed: true,
	};
}

function isEmptyFrontmatterValue(value: string): boolean {
	const withoutComment = value.split("#")[0]?.trim() ?? "";
	return withoutComment === "" || withoutComment === "\"\"" || withoutComment === "''";
}

function findInsertionIndex(lines: string[], precedingKey: string): number {
	const precedingIndex = lines.findIndex((line) => new RegExp(`^${precedingKey}\\s*:`).test(line));
	return precedingIndex >= 0 ? precedingIndex + 1 : lines.length;
}

function generateSlug(source: string, fallbackBasename: string): string {
	const created = readCreatedValue(source);
	const createdDate = parseCreatedDate(created);
	if (createdDate) {
		return formatSlugDate(createdDate);
	}

	return sanitizeSlugSegment(fallbackBasename) || formatSlugDate(new Date());
}

function readCreatedValue(source: string): unknown {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return undefined;
	}

	try {
		const parsed = parseYaml(match[1] ?? "") as {created?: unknown} | null;
		return parsed?.created;
	} catch {
		return undefined;
	}
}

function parseCreatedDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	if (typeof value !== "string") {
		return null;
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatSlugDate(date: Date): string {
	const year = date.getFullYear().toString().padStart(4, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const seconds = date.getSeconds().toString().padStart(2, "0");
	return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function sanitizeSlugSegment(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9/_-]+/g, "-")
		.replace(/\/{2,}/g, "/")
		.replace(/^-+|-+$/g, "")
		.replace(/^\/+|\/+$/g, "");
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
