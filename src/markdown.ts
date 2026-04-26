import {App, normalizePath, TFile} from "obsidian";
import {PreparedAsset} from "./types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"]);
const MAX_ASSET_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_ASSET_SIZE = 20 * 1024 * 1024;

interface Replacement {
	start: number;
	end: number;
	value: string;
}

interface AssetTarget {
	file: TFile;
	targetFilename: string;
	targetPath: string;
}

export class MarkdownError extends Error {
	constructor(message: string, public readonly details: string[] = []) {
		super(message);
	}
}

export async function prepareMarkdownBody(
	app: App,
	sourceFile: TFile,
	body: string,
	postDirectory: string,
): Promise<{body: string; assets: PreparedAsset[]}> {
	const unsupportedWikiLinks = findUnsupportedWikiLinks(body);
	if (unsupportedWikiLinks.length > 0) {
		throw new MarkdownError(`Unsupported wiki links: ${unsupportedWikiLinks.join(", ")}`, unsupportedWikiLinks);
	}

	const replacements: Replacement[] = [];
	const targetsByPath = new Map<string, AssetTarget>();
	const usedFilenames = new Set<string>();

	collectWikiImageReplacements(app, sourceFile, body, postDirectory, replacements, targetsByPath, usedFilenames);
	collectMarkdownImageReplacements(app, sourceFile, body, postDirectory, replacements, targetsByPath, usedFilenames);

	const assets = await readAssets(app, [...targetsByPath.values()]);
	const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
	if (totalSize > MAX_TOTAL_ASSET_SIZE) {
		throw new MarkdownError("Attached images exceed the 20MB total limit.");
	}

	return {
		body: applyReplacements(body, replacements),
		assets,
	};
}

export function isImagePath(path: string): boolean {
	const extension = path.split(".").pop()?.toLowerCase();
	return extension !== undefined && IMAGE_EXTENSIONS.has(extension);
}

export function isManagedImagePath(path: string): boolean {
	return isImagePath(path) && !path.slice(path.lastIndexOf("/") + 1).startsWith(".");
}

function findUnsupportedWikiLinks(body: string): string[] {
	const unsupported: string[] = [];
	const regex = /(!?)\[\[([^\]]+)\]\]/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(body)) !== null) {
		const isEmbed = match[1] === "!";
		const linkText = match[2] ?? "";
		const linkPath = cleanWikiTarget(linkText);
		if (!isEmbed || !isImagePath(linkPath)) {
			unsupported.push(match[0]);
		}
	}

	return unsupported;
}

function collectWikiImageReplacements(
	app: App,
	sourceFile: TFile,
	body: string,
	postDirectory: string,
	replacements: Replacement[],
	targetsByPath: Map<string, AssetTarget>,
	usedFilenames: Set<string>,
): void {
	const regex = /!\[\[([^\]]+)\]\]/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(body)) !== null) {
		const rawTarget = match[1] ?? "";
		const linkPath = cleanWikiTarget(rawTarget);
		const file = resolveVaultFile(app, sourceFile, linkPath);
		const target = getAssetTarget(file, postDirectory, targetsByPath, usedFilenames);
		replacements.push({
			start: match.index,
			end: match.index + match[0].length,
			value: `![${stripExtension(target.targetFilename)}](./${target.targetFilename})`,
		});
	}
}

function collectMarkdownImageReplacements(
	app: App,
	sourceFile: TFile,
	body: string,
	postDirectory: string,
	replacements: Replacement[],
	targetsByPath: Map<string, AssetTarget>,
	usedFilenames: Set<string>,
): void {
	const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(body)) !== null) {
		const alt = match[1] ?? "";
		const rawUrl = (match[2] ?? "").trim();
		if (isExternalUrl(rawUrl) || rawUrl.startsWith("#")) {
			continue;
		}

		const linkPath = stripMarkdownUrlDecorations(rawUrl);
		if (!isImagePath(linkPath)) {
			throw new MarkdownError(`Unsupported image type: ${rawUrl}`, [rawUrl]);
		}

		const file = resolveVaultFile(app, sourceFile, decodeURIComponent(linkPath));
		const target = getAssetTarget(file, postDirectory, targetsByPath, usedFilenames);
		replacements.push({
			start: match.index,
			end: match.index + match[0].length,
			value: `![${alt}](./${target.targetFilename})`,
		});
	}
}

function resolveVaultFile(app: App, sourceFile: TFile, linkPath: string): TFile {
	const cleanPath = normalizePath(linkPath);
	const byMetadata = app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
	if (byMetadata) {
		return byMetadata;
	}

	const sourceDirectory = sourceFile.parent?.path ?? "";
	const relativePath = normalizePath(`${sourceDirectory}/${cleanPath}`);
	const byPath = app.vault.getFileByPath(relativePath) ?? app.vault.getFileByPath(cleanPath);
	if (byPath) {
		return byPath;
	}

	throw new MarkdownError(`Image not found in vault: ${linkPath}`, [linkPath]);
}

function getAssetTarget(
	file: TFile,
	postDirectory: string,
	targetsByPath: Map<string, AssetTarget>,
	usedFilenames: Set<string>,
): AssetTarget {
	const existing = targetsByPath.get(file.path);
	if (existing) {
		return existing;
	}

	const targetFilename = allocateFilename(file.name, usedFilenames);
	const target = {
		file,
		targetFilename,
		targetPath: `${postDirectory}/${targetFilename}`,
	};
	targetsByPath.set(file.path, target);
	return target;
}

async function readAssets(app: App, targets: AssetTarget[]): Promise<PreparedAsset[]> {
	const assets: PreparedAsset[] = [];

	for (const target of targets) {
		const data = await app.vault.readBinary(target.file);
		const size = data.byteLength;
		if (size > MAX_ASSET_SIZE) {
			throw new MarkdownError(`Image exceeds the 5MB file limit: ${target.file.path}`, [target.file.path]);
		}
		assets.push({
			sourcePath: target.file.path,
			targetFilename: target.targetFilename,
			targetPath: target.targetPath,
			data,
			size,
		});
	}

	return assets;
}

function applyReplacements(body: string, replacements: Replacement[]): string {
	let result = body;
	for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
		result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`;
	}
	return result;
}

function cleanWikiTarget(target: string): string {
	return target.split("|")[0]?.split("#")[0]?.trim() ?? "";
}

function stripMarkdownUrlDecorations(url: string): string {
	const withoutTitle = url.match(/^<(.+)>$/)?.[1] ?? url.split(/\s+["']/)[0] ?? url;
	return withoutTitle.split("#")[0]?.split("?")[0] ?? withoutTitle;
}

function isExternalUrl(url: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

function allocateFilename(originalName: string, usedFilenames: Set<string>): string {
	const sanitized = sanitizeFilename(originalName);
	const dotIndex = sanitized.lastIndexOf(".");
	const basename = dotIndex > 0 ? sanitized.slice(0, dotIndex) : sanitized;
	const extension = dotIndex > 0 ? sanitized.slice(dotIndex) : "";
	let candidate = sanitized;
	let suffix = 2;

	while (usedFilenames.has(candidate)) {
		candidate = `${basename}-${suffix}${extension}`;
		suffix += 1;
	}

	usedFilenames.add(candidate);
	return candidate;
}

function sanitizeFilename(filename: string): string {
	const dotIndex = filename.lastIndexOf(".");
	const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
	const extension = dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : "";
	const sanitizedBase = basename
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${sanitizedBase || "image"}${extension}`;
}

function stripExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf(".");
	return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}
