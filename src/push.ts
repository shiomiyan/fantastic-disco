import {App, MarkdownView, Notice, normalizePath, TFile} from "obsidian";
import {parsePostContent, buildBlogMarkdown, ensurePostId} from "./frontmatter";
import {GitHubClient} from "./github";
import {prepareMarkdownBody} from "./markdown";
import {BlogPushSettings, PreparedPost, PushSummary} from "./types";

export class BlogPushError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export async function pushCurrentNote(
	app: App,
	settings: BlogPushSettings,
	dryRun: boolean,
): Promise<PushSummary> {
	const file = getActiveMarkdownFile(app);
	let source = await app.vault.read(file);
	const idResult = ensurePostId(source);
	if (idResult.generatedId) {
		source = idResult.source;
		await app.vault.modify(file, source);
		new Notice(`Generated blog post id: ${idResult.generatedId}`);
	}
	const post = parsePostContent(source);
	const postDirectory = normalizePath(`${settings.postsDirectory}/${post.frontmatter.slug}`);
	const indexPath = `${postDirectory}/index.md`;
	const preparedBody = await prepareMarkdownBody(app, file, post.body, postDirectory);
	const markdown = buildBlogMarkdown(post, ensureTrailingNewline(preparedBody.body));
	const preparedPost: PreparedPost = {
		frontmatter: {
			title: post.frontmatter.title,
			description: post.frontmatter.description,
			created: post.frontmatter.created,
			draft: post.frontmatter.draft,
			id: post.frontmatter.id,
			category: post.frontmatter.category,
			tags: post.frontmatter.tags,
		},
		slug: post.frontmatter.slug,
		markdown: ensureTrailingNewline(markdown),
		postDirectory,
		indexPath,
		assets: preparedBody.assets,
	};

	const token = await loadGitHubToken(app, settings.githubTokenSecret);
	const client = new GitHubClient(settings, token);
	return client.pushPost(preparedPost, dryRun);
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

async function loadGitHubToken(app: App, secretName: string): Promise<string> {
	if (!secretName.trim()) {
		throw new BlogPushError("Set a GitHub token secret in plugin settings.");
	}

	const token = app.secretStorage.getSecret(secretName);
	if (!token) {
		throw new BlogPushError("GitHub token secret is empty or missing.");
	}
	return token;
}

function ensureTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}
