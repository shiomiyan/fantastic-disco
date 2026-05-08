import { App, MarkdownView, Notice, normalizePath, TFile } from "obsidian";
import { parsePostContent, buildBlogMarkdown } from "../frontmatter";
import { pushPostToGitHub } from "../github";
import { loadRequiredSecret } from "../secrets";
import { prepareMarkdownBody } from "../markdown";
import type { BlogPushSettings, PreparedPost, PushSummary } from "../types";

export class BlogPushError extends Error {}

export async function pushCurrentNote(
	app: App,
	settings: BlogPushSettings,
	dryRun: boolean,
): Promise<PushSummary> {
	const file = getActiveMarkdownFile(app);
	const source = await app.vault.read(file);
	const post = parsePostContent(source);
	const postDirectory = normalizePath(`${settings.postsDirectory}/${post.frontmatter.slug}`);
	const indexPath = `${postDirectory}/index.md`;
	const preparedBody = await prepareMarkdownBody(app, file, post.body, postDirectory);
	const markdown = buildBlogMarkdown(post, ensureTrailingNewline(preparedBody.body));
	const { slug, ...frontmatter } = post.frontmatter;
	const preparedPost: PreparedPost = {
		frontmatter,
		slug,
		markdown: ensureTrailingNewline(markdown),
		postDirectory,
		indexPath,
		assets: preparedBody.assets,
	};

	const token = loadRequiredSecret(app, settings.githubTokenSecret);
	return pushPostToGitHub(settings, token, preparedPost, dryRun);
}

export function summarizeSuccess(summary: PushSummary, branch: string): string {
	if (summary.dryRun) {
		return `Dry run OK: would update ${summary.changedFiles} files and delete ${summary.deletedImages} images.`;
	}

	const shortSha = summary.commitSha?.slice(0, 7) ?? "unknown";
	return `Pushed to ${branch}: ${shortSha}`;
}

export function notifyWarnings(summary: PushSummary): void {
	for (const warning of summary.warnings) {
		new Notice(warning, 8000);
	}
}

function getActiveMarkdownFile(app: App): TFile {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!file || file.extension !== "md") {
		throw new BlogPushError("Open a Markdown note before pushing to blog.");
	}
	return file;
}

function ensureTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}
