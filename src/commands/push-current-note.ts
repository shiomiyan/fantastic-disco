import { Notice } from "obsidian";
import { notifyWarnings, pushCurrentNote, summarizeSuccess } from "../push";
import type BlogPushPlugin from "../main";

interface PushCommandState {
	isPushing: boolean;
}

export async function runPushCurrentNote(
	plugin: BlogPushPlugin,
	state: PushCommandState,
	dryRun: boolean,
): Promise<void> {
	if (state.isPushing) {
		new Notice("Blog repository push is already running.");
		return;
	}

	state.isPushing = true;
	plugin.setStatus(dryRun ? "Checking blog repository push..." : "Pushing to blog repository...");
	new Notice(
		dryRun ? "Preparing dry run blog repository push..." : "Preparing blog repository push...",
	);

	try {
		const summary = await pushCurrentNote(plugin.app, plugin.settings, dryRun);
		notifyWarnings(summary);
		new Notice(summarizeSuccess(summary, plugin.settings.pushBranch), 8000);
		if (summary.commitUrl) {
			console.debug("Blog repository push commit:", summary.commitUrl);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Blog repository push failed.", error);
		new Notice(`Blog repository push failed: ${message}`, 10000);
	} finally {
		state.isPushing = false;
		plugin.clearStatus();
	}
}
