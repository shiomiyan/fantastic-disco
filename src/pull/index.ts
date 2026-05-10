import { App, MarkdownView, Notice, TFile } from "obsidian";
import { parsePostContent, readFrontmatter, replaceFrontmatter } from "../frontmatter";
import { normalizeCategoriesForObsidian } from "../frontmatter/categories";
import { fetchPostFromGitHub } from "../github";
import { loadGithubToken } from "../secrets";
import type { BlogPushSettings } from "../settings";
import type { PullSummary } from "../types";

export class BlogPullError extends Error {}

export async function pullCurrentNote(
	app: App,
	settings: BlogPushSettings,
	dryRun: boolean,
): Promise<PullSummary> {
	const file = getActiveMarkdownFile(app);
	const source = await app.vault.read(file);
	const post = parsePostContent(source);
	const indexPath = `${settings.postsDirectory}/${post.frontmatter.slug}/index.md`;
	const token = loadGithubToken(app, settings.githubTokenSecret);
	const remoteMarkdown = await fetchPostFromGitHub(settings, token, indexPath);
	const remoteFrontmatter = readFrontmatter(remoteMarkdown);
	const remoteCategories = getRemoteCategoryIds(remoteFrontmatter);
	const localCategories = await normalizeCategoriesForObsidian(
		app,
		file,
		post.frontmatter.categories,
		remoteCategories,
	);
	const normalizedRemoteMarkdown = ensureTrailingNewline(
		replaceFrontmatter(remoteMarkdown, (frontmatter) => ({
			...frontmatter,
			slug: post.frontmatter.slug,
			categories: localCategories,
		})),
	);

	if (dryRun) {
		return {
			updated: source !== normalizedRemoteMarkdown,
			indexPath,
			dryRun: true,
		};
	}

	if (source === normalizedRemoteMarkdown) {
		return {
			updated: false,
			indexPath,
			dryRun: false,
		};
	}

	await backupCurrentFile(app, file, source);
	await app.vault.modify(file, normalizedRemoteMarkdown);

	return {
		updated: true,
		indexPath,
		dryRun: false,
	};
}

function getActiveMarkdownFile(app: App): TFile {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!file || file.extension !== "md") {
		throw new BlogPullError("Open a Markdown note before pulling from blog.");
	}
	return file;
}

async function backupCurrentFile(app: App, file: TFile, source: string): Promise<void> {
	const backupPath = `${file.path}.bak`;
	const existing = app.vault.getAbstractFileByPath(backupPath);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, ensureTrailingNewline(source));
		return;
	}

	await app.vault.create(backupPath, ensureTrailingNewline(source));
	new Notice(`Backed up current note to ${backupPath}`);
}

function ensureTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}

function getRemoteCategoryIds(frontmatter: Record<string, unknown>): string[] {
	const { categories } = frontmatter;
	if (!Array.isArray(categories) || !categories.every((item) => typeof item === "string")) {
		throw new Error('Remote frontmatter "categories" must be an array of strings.');
	}
	return categories;
}
