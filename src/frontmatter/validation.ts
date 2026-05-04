import type { BlogFrontmatter } from "../types";

export const REQUIRED_FRONTMATTER_KEYS = [
	"title",
	"description",
	"created",
	"draft",
	"id",
	"category",
	"tags",
	"slug",
] as const;

export type RequiredFrontmatterKey = (typeof REQUIRED_FRONTMATTER_KEYS)[number];

export class FrontmatterError extends Error {
	constructor(
		message: string,
		public readonly details: string[] = [],
	) {
		super(message);
	}
}

export function validateFrontmatter(
	data: Partial<Record<RequiredFrontmatterKey, unknown>>,
): BlogFrontmatter {
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
