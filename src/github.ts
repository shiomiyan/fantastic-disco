import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { arrayBufferToBase64, base64ToArrayBuffer } from "obsidian";
import { isManagedImagePath } from "./markdown";
import type { BlogPushSettings, PreparedPost, PushSummary } from "./types";

interface TreeMutation {
	path: string;
	mode: "100644";
	type: "blob";
	sha: string | null;
}

export async function pushPostToGitHub(
	settings: BlogPushSettings,
	token: string,
	post: PreparedPost,
	dryRun: boolean,
): Promise<PushSummary> {
	const octokit = new Octokit({
		auth: token,
		userAgent: "obsidian-blog-push",
	});
	const repo = {
		owner: settings.owner,
		repo: settings.repo,
	};

	const warnings: string[] = [];
	try {
		const { data: compare } = await octokit.rest.repos.compareCommitsWithBasehead({
			...repo,
			basehead: `${settings.baseBranch}...${settings.pushBranch}`,
		});
		if (compare.status === "behind" || compare.status === "diverged") {
			warnings.push(`${settings.pushBranch} is ${compare.status} ${settings.baseBranch}.`);
		}
	} catch (error) {
		console.warn("Could not compare branches before blog push.", error);
	}

	let initialHead = await getBranchHead(octokit, repo, settings.pushBranch, true);
	if (!initialHead) {
		const baseHead = await getBranchHead(octokit, repo, settings.baseBranch);
		if (!baseHead) {
			throw new Error(`Branch not found: ${settings.baseBranch}`);
		}

		await octokit.rest.git.createRef({
			...repo,
			ref: `refs/heads/${settings.pushBranch}`,
			sha: baseHead,
		});
		initialHead = baseHead;
	}

	const { data: baseCommit } = await octokit.rest.git.getCommit({
		...repo,
		commit_sha: initialHead,
	});
	const { data: tree } = await octokit.rest.git.getTree({
		...repo,
		tree_sha: baseCommit.tree.sha,
		recursive: "true",
	});
	if (tree.truncated) {
		throw new Error("Repository tree is too large for a recursive GitHub API response.");
	}

	const existingIndex = tree.tree.find(
		(entry) => entry.path === post.indexPath && entry.type === "blob",
	);
	if (existingIndex?.sha) {
		const content = await getBlobText(octokit, repo, existingIndex.sha);
		const idMatch = content.match(/\nid:\s*["']?([^"'\n]+)["']?\s*(?:\n|$)/);
		if (!idMatch) {
			throw new Error("Existing post has no readable id; refusing to overwrite.");
		}
		if (idMatch[1]?.trim() !== post.frontmatter.id) {
			throw new Error("Existing post id does not match; refusing to overwrite.");
		}
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

	const mutations: TreeMutation[] = [
		{
			path: post.indexPath,
			mode: "100644",
			type: "blob",
			sha: await createTextBlob(octokit, repo, post.markdown),
		},
	];

	for (const asset of post.assets) {
		mutations.push({
			path: asset.targetPath,
			mode: "100644",
			type: "blob",
			sha: await createBlob(octokit, repo, arrayBufferToBase64(asset.data)),
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

	const latestHead = await getBranchHead(octokit, repo, settings.pushBranch);
	if (latestHead !== initialHead) {
		throw new Error(
			"Push branch changed while preparing the commit. Retry after pulling the latest branch state.",
		);
	}

	const { data: newTree } = await octokit.rest.git.createTree({
		...repo,
		base_tree: baseCommit.tree.sha,
		tree: mutations,
	});
	const { data: commit } = await octokit.rest.git.createCommit({
		...repo,
		message: `Update post from Obsidian: ${post.frontmatter.title}`,
		tree: newTree.sha,
		parents: [initialHead],
	});
	await octokit.rest.git.updateRef({
		...repo,
		ref: `heads/${settings.pushBranch}`,
		sha: commit.sha,
		force: false,
	});

	return {
		commitSha: commit.sha,
		commitUrl: commit.html_url,
		changedFiles: 1 + post.assets.length,
		deletedImages: deletedImages.length,
		warnings,
		dryRun: false,
	};
}

async function getBranchHead(
	octokit: Octokit,
	repo: { owner: string; repo: string },
	branch: string,
	optional = false,
): Promise<string | null> {
	try {
		const { data: ref } = await octokit.rest.git.getRef({
			...repo,
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

async function getBlobText(
	octokit: Octokit,
	repo: { owner: string; repo: string },
	blobSha: string,
): Promise<string> {
	const { data: blob } = await octokit.rest.git.getBlob({
		...repo,
		file_sha: blobSha,
	});
	if (blob.encoding !== "base64") {
		throw new Error(`Unsupported blob encoding: ${blob.encoding}`);
	}
	const normalized = blob.content.replace(/\s/g, "");
	return new TextDecoder().decode(base64ToArrayBuffer(normalized));
}

async function createTextBlob(
	octokit: Octokit,
	repo: { owner: string; repo: string },
	content: string,
): Promise<string> {
	const data = new TextEncoder().encode(content);
	return createBlob(octokit, repo, arrayBufferToBase64(data.buffer));
}

async function createBlob(
	octokit: Octokit,
	repo: { owner: string; repo: string },
	content: string,
): Promise<string> {
	const { data: blob } = await octokit.rest.git.createBlob({
		...repo,
		content,
		encoding: "base64",
	});
	return blob.sha;
}

function isDirectChild(path: string, directory: string): boolean {
	if (!path.startsWith(`${directory}/`)) {
		return false;
	}
	return !path.slice(directory.length + 1).includes("/");
}
