import { App, MarkdownView, Notice, TFile } from "obsidian";
import { parsePostContent } from "../frontmatter";
import { fetchPostFromGitHub } from "../github";
import { loadGithubToken } from "../secrets";
import type { BlogPushSettings, PullSummary } from "../types";

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

	if (dryRun) {
		return {
			updated: source !== remoteMarkdown,
			indexPath,
			dryRun: true,
		};
	}

	if (source === remoteMarkdown) {
		return {
			updated: false,
			indexPath,
			dryRun: false,
		};
	}

	await backupCurrentFile(app, file, source);
	await app.vault.modify(file, ensureTrailingNewline(remoteMarkdown));

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
