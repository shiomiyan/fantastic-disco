import { App, getFrontMatterInfo, parseYaml, TFile } from "obsidian";

interface CategoryLinkTarget {
	file: TFile;
	id: string;
}

export class CategoryNormalizationError extends Error {
	constructor(
		message: string,
		public readonly details: string[],
	) {
		super(details.length > 0 ? `${message} ${details.join(" ")}` : message);
	}
}

export async function normalizeCategoriesForBlog(
	app: App,
	sourceFile: TFile,
	categories: string[],
): Promise<string[]> {
	const resolved = await resolveCategoryLinkTargets(app, sourceFile, categories);
	return resolved.map((entry) => entry.id);
}

export async function normalizeCategoriesForObsidian(
	app: App,
	sourceFile: TFile,
	localCategories: string[],
	remoteCategoryIds: string[],
): Promise<string[]> {
	const resolved = await resolveCategoryLinkTargets(app, sourceFile, localCategories);
	const idsToLinks = new Map<string, string>();
	const errors: string[] = [];

	for (const entry of resolved) {
		const existing = idsToLinks.get(entry.id);
		if (existing) {
			errors.push(
				`Category id "${entry.id}" is duplicated across "${existing}" and "${entry.file.path}".`,
			);
			continue;
		}
		idsToLinks.set(entry.id, `[[${entry.file.basename}]]`);
	}

	const normalized = remoteCategoryIds.map((id) => {
		const link = idsToLinks.get(id);
		if (!link) {
			errors.push(
				`Category id "${id}" is not linked from "${sourceFile.path}" in current note frontmatter.`,
			);
			return "";
		}
		return link;
	});

	if (errors.length > 0) {
		throw new CategoryNormalizationError("Could not normalize categories.", errors);
	}

	return normalized;
}

function parseSimpleWikiLink(category: string): string | null {
	const match = category.match(/^\[\[([^\]|#]+)\]\]$/);
	return match?.[1]?.trim() || null;
}

async function resolveCategoryLinkTarget(
	app: App,
	sourceFile: TFile,
	category: string,
): Promise<CategoryLinkTarget> {
	const target = parseSimpleWikiLink(category);
	if (!target) {
		throw new CategoryNormalizationError("Could not normalize categories.", [
			`Category "${category}" must be a simple wikilink like [[Category Note]].`,
		]);
	}

	const file = app.metadataCache.getFirstLinkpathDest(target, sourceFile.path);
	if (!file) {
		throw new CategoryNormalizationError("Could not normalize categories.", [
			`Category link "${category}" could not be resolved from "${sourceFile.path}".`,
		]);
	}

	const id = await readFrontmatterId(app, file);
	if (!id) {
		throw new CategoryNormalizationError("Could not normalize categories.", [
			`Category link "${category}" points to note "${file.path}" without frontmatter id.`,
		]);
	}

	return {
		file,
		id,
	};
}

async function resolveCategoryLinkTargets(
	app: App,
	sourceFile: TFile,
	categories: string[],
): Promise<CategoryLinkTarget[]> {
	const resolved: CategoryLinkTarget[] = [];
	const errors: string[] = [];

	for (const category of categories) {
		try {
			resolved.push(await resolveCategoryLinkTarget(app, sourceFile, category));
		} catch (error) {
			if (error instanceof CategoryNormalizationError) {
				errors.push(...error.details);
				continue;
			}
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	if (errors.length > 0) {
		throw new CategoryNormalizationError("Could not normalize categories.", errors);
	}

	return resolved;
}

async function readFrontmatterId(app: App, file: TFile): Promise<string | null> {
	const source = await app.vault.cachedRead(file);
	const info = getFrontMatterInfo(source);
	if (!info.exists) {
		return null;
	}

	const parsed = parseYaml(info.frontmatter);
	if (!isRecord(parsed)) {
		return null;
	}

	return typeof parsed.id === "string" && parsed.id.trim() !== "" ? parsed.id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
