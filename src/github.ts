import {RequestError} from "@octokit/request-error";
import {Octokit} from "@octokit/rest";
import {arrayBufferToBase64, base64ToArrayBuffer} from "obsidian";
import {isManagedImagePath} from "./markdown";
import type {BlogPushSettings, PreparedPost, PushSummary} from "./types";

interface TreeMutation {
	path: string;
	mode: "100644";
	type: "blob";
	sha: string | null;
}

export class GitHubError extends Error {
	constructor(message: string, public readonly status?: number) {
		super(message);
	}
}

export class GitHubClient {
	private readonly octokit: Octokit;

	constructor(
		private readonly settings: BlogPushSettings,
		token: string,
	) {
		this.octokit = new Octokit({
			auth: token,
			userAgent: "obsidian-blog-push",
		});
	}

	async pushPost(post: PreparedPost, dryRun: boolean): Promise<PushSummary> {
		try {
			return await this.pushPostWithOctokit(post, dryRun);
		} catch (error) {
			throw normalizeGitHubError(error);
		}
	}

	private async pushPostWithOctokit(post: PreparedPost, dryRun: boolean): Promise<PushSummary> {
		const warnings = await this.getBranchWarnings();
		const initialHead = await this.ensurePushBranch();
		const baseCommit = await this.getCommit(initialHead);
		const tree = await this.getTree(baseCommit.tree.sha);
		const existingIndex = tree.tree.find((entry) => entry.path === post.indexPath && entry.type === "blob");

		if (existingIndex?.sha) {
			await this.assertExistingId(existingIndex.sha, post.frontmatter.id);
		}

		const targetAssetPaths = new Set(post.assets.map((asset) => asset.targetPath));
		const deletedImages = tree.tree.filter((entry) => {
			if (entry.type !== "blob" || !entry.path) {
				return false;
			}
			if (!isDirectChild(entry.path, post.postDirectory)) {
				return false;
			}
			return isManagedImagePath(entry.path) && !targetAssetPaths.has(entry.path);
		});

		if (dryRun) {
			return {
				changedFiles: 1 + post.assets.length,
				deletedImages: deletedImages.length,
				warnings,
				dryRun: true,
			};
		}

		const mutations: TreeMutation[] = [];
		mutations.push({
			path: post.indexPath,
			mode: "100644",
			type: "blob",
			sha: await this.createTextBlob(post.markdown),
		});

		for (const asset of post.assets) {
			mutations.push({
				path: asset.targetPath,
				mode: "100644",
				type: "blob",
				sha: await this.createBinaryBlob(asset.data),
			});
		}

		for (const image of deletedImages) {
			if (image.path) {
				mutations.push({
					path: image.path,
					mode: "100644",
					type: "blob",
					sha: null,
				});
			}
		}

		const latestHead = await this.getBranchHead(this.settings.pushBranch);
		if (latestHead !== initialHead) {
			throw new GitHubError("Push branch changed while preparing the commit. Retry after pulling the latest branch state.");
		}

		const newTreeSha = await this.createTree(baseCommit.tree.sha, mutations);
		const commit = await this.createCommit(`Update post from Obsidian: ${post.frontmatter.title}`, newTreeSha, initialHead);
		await this.updateRef(this.settings.pushBranch, commit.sha);

		return {
			commitSha: commit.sha,
			commitUrl: commit.html_url,
			changedFiles: 1 + post.assets.length,
			deletedImages: deletedImages.length,
			warnings,
			dryRun: false,
		};
	}

	private async ensurePushBranch(): Promise<string> {
		const existing = await this.getBranchHead(this.settings.pushBranch, true);
		if (existing) {
			return existing;
		}

		const baseHead = await this.getRequiredBranchHead(this.settings.baseBranch);
		await this.octokit.rest.git.createRef({
			...this.repoParams(),
			ref: `refs/heads/${this.settings.pushBranch}`,
			sha: baseHead,
		});
		return baseHead;
	}

	private async getBranchWarnings(): Promise<string[]> {
		try {
			const {data: compare} = await this.octokit.rest.repos.compareCommitsWithBasehead({
				...this.repoParams(),
				basehead: `${this.settings.baseBranch}...${this.settings.pushBranch}`,
			});
			if (compare.status === "behind" || compare.status === "diverged") {
				return [`${this.settings.pushBranch} is ${compare.status} ${this.settings.baseBranch}.`];
			}
		} catch (error) {
			console.warn("Could not compare branches before blog push.", error);
		}
		return [];
	}

	private async assertExistingId(blobSha: string, expectedId: string): Promise<void> {
		const content = await this.getBlobText(blobSha);
		const idMatch = content.match(/\nid:\s*["']?([^"'\n]+)["']?\s*(?:\n|$)/);
		if (!idMatch) {
			throw new GitHubError("Existing post has no readable id; refusing to overwrite.");
		}
		const existingId = idMatch[1]?.trim();
		if (existingId !== expectedId) {
			throw new GitHubError("Existing post id does not match; refusing to overwrite.");
		}
	}

	private async getBranchHead(branch: string, optional = false): Promise<string | null> {
		try {
			const {data: ref} = await this.octokit.rest.git.getRef({
				...this.repoParams(),
				ref: `heads/${branch}`,
			});
			return ref.object.sha;
		} catch (error) {
			if (optional && error instanceof RequestError && error.status === 404) {
				return null;
			}
			throw error;
		}
	}

	private async getRequiredBranchHead(branch: string): Promise<string> {
		const head = await this.getBranchHead(branch);
		if (!head) {
			throw new GitHubError(`Branch not found: ${branch}`);
		}
		return head;
	}

	private async getCommit(sha: string) {
		const {data} = await this.octokit.rest.git.getCommit({
			...this.repoParams(),
			commit_sha: sha,
		});
		return data;
	}

	private async getTree(treeSha: string) {
		const {data} = await this.octokit.rest.git.getTree({
			...this.repoParams(),
			tree_sha: treeSha,
			recursive: "true",
		});
		if (data.truncated) {
			throw new GitHubError("Repository tree is too large for a recursive GitHub API response.");
		}
		return data;
	}

	private async getBlobText(blobSha: string): Promise<string> {
		const {data: blob} = await this.octokit.rest.git.getBlob({
			...this.repoParams(),
			file_sha: blobSha,
		});
		if (blob.encoding !== "base64") {
			throw new GitHubError(`Unsupported blob encoding: ${blob.encoding}`);
		}
		const normalized = blob.content.replace(/\s/g, "");
		return new TextDecoder().decode(base64ToArrayBuffer(normalized));
	}

	private async createTextBlob(content: string): Promise<string> {
		const data = new TextEncoder().encode(content);
		return this.createBlob(arrayBufferToBase64(data.buffer));
	}

	private async createBinaryBlob(data: ArrayBuffer): Promise<string> {
		return this.createBlob(arrayBufferToBase64(data));
	}

	private async createBlob(content: string): Promise<string> {
		const {data: blob} = await this.octokit.rest.git.createBlob({
			...this.repoParams(),
			content,
			encoding: "base64",
		});
		return blob.sha;
	}

	private async createTree(baseTree: string, tree: TreeMutation[]): Promise<string> {
		const {data} = await this.octokit.rest.git.createTree({
			...this.repoParams(),
			base_tree: baseTree,
			tree,
		});
		return data.sha;
	}

	private async createCommit(message: string, tree: string, parent: string) {
		const {data} = await this.octokit.rest.git.createCommit({
			...this.repoParams(),
			message,
			tree,
			parents: [parent],
		});
		return data;
	}

	private async updateRef(branch: string, sha: string): Promise<void> {
		await this.octokit.rest.git.updateRef({
			...this.repoParams(),
			ref: `heads/${branch}`,
			sha,
			force: false,
		});
	}

	private repoParams(): {owner: string; repo: string} {
		return {
			owner: this.settings.owner,
			repo: this.settings.repo,
		};
	}
}

function isDirectChild(path: string, directory: string): boolean {
	if (!path.startsWith(`${directory}/`)) {
		return false;
	}
	return !path.slice(directory.length + 1).includes("/");
}

function normalizeGitHubError(error: unknown): Error {
	if (error instanceof GitHubError) {
		return error;
	}
	if (error instanceof RequestError) {
		return new GitHubError(error.message, error.status);
	}
	if (error instanceof Error) {
		return error;
	}
	return new Error(String(error));
}
