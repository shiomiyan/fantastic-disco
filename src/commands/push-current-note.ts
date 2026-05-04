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
		new Notice("Blog push is already running.");
		return;
	}

	state.isPushing = true;
	plugin.setStatus(dryRun ? "Checking blog push..." : "Pushing to blog...");
	new Notice(dryRun ? "Preparing dry run blog push..." : "Preparing blog push...");

	try {
		const summary = await pushCurrentNote(plugin.app, plugin.settings, dryRun);
		notifyWarnings(summary);
		new Notice(summarizeSuccess(summary, plugin.settings.pushBranch), 8000);
		if (summary.commitUrl) {
			console.debug("Blog push commit:", summary.commitUrl);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Blog push failed.", error);
		new Notice(`Blog push failed: ${message}`, 10000);
	} finally {
		state.isPushing = false;
		plugin.clearStatus();
	}
}
