import { getLinkpath } from "obsidian";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"]);

export function isImagePath(path: string): boolean {
	const extension = path.split(".").pop()?.toLowerCase();
	return extension !== undefined && IMAGE_EXTENSIONS.has(extension);
}

export function isManagedImagePath(path: string): boolean {
	return isImagePath(path) && !path.slice(path.lastIndexOf("/") + 1).startsWith(".");
}

export function cleanWikiTarget(target: string): string {
	return getLinkpath(target);
}

export function stripMarkdownUrlDecorations(url: string): string {
	const withoutTitle = url.match(/^<(.+)>$/)?.[1] ?? url.split(/\s+["']/)[0] ?? url;
	return withoutTitle.split("#")[0]?.split("?")[0] ?? withoutTitle;
}

export function isExternalUrl(url: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

export function allocateFilename(originalName: string, usedFilenames: Set<string>): string {
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

export function stripExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf(".");
	return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
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
