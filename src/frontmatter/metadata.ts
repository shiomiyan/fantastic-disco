import { App, TFile } from "obsidian";

export interface FilledPostMetadata {
	generatedId: string | null;
	generatedSlug: string | null;
}

export async function fillPostMetadata(app: App, file: TFile): Promise<FilledPostMetadata> {
	const generatedId = crypto.randomUUID();
	let generatedSlug: string | null = null;
	let filledId: string | null = null;
	let filledSlug: string | null = null;

	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		if (isEmptyFrontmatterValue(frontmatter.id)) {
			frontmatter.id = generatedId;
			filledId = generatedId;
		}

		if (isEmptyFrontmatterValue(frontmatter.slug)) {
			generatedSlug = generateSlug(frontmatter.created, file.basename);
			frontmatter.slug = generatedSlug;
			filledSlug = generatedSlug;
		}
	});

	return {
		generatedId: filledId,
		generatedSlug: filledSlug,
	};
}

function isEmptyFrontmatterValue(value: unknown): boolean {
	if (value === undefined || value === null) {
		return true;
	}
	return typeof value === "string" && value.trim() === "";
}

function generateSlug(created: unknown, fallbackBasename: string): string {
	const createdDate = parseCreatedDate(created);
	if (createdDate) {
		return formatSlugDate(createdDate);
	}

	return sanitizeSlugSegment(fallbackBasename) || formatSlugDate(new Date());
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
