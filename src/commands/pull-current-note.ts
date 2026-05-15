import { Notice } from "obsidian";
import { pullCurrentNote } from "../pull";
import type BlogPushPlugin from "../main";

interface PullCommandState {
	isPulling: boolean;
}

export async function runPullCurrentNote(
	plugin: BlogPushPlugin,
	state: PullCommandState,
	dryRun: boolean,
): Promise<void> {
	if (state.isPulling) {
		new Notice("Blog repository pull is already running.");
		return;
	}

	state.isPulling = true;
	plugin.setStatus(
		dryRun ? "Checking blog repository pull..." : "Pulling from blog repository...",
	);
	new Notice(
		dryRun
			? "Preparing dry run blog repository pull..."
			: "Force pull will overwrite this note with remote content.",
	);

	try {
		const summary = await pullCurrentNote(plugin.app, plugin.settings, dryRun);
		if (summary.dryRun) {
			new Notice(
				summary.updated
					? `Dry run OK: note would be overwritten from ${summary.indexPath}.`
					: `Dry run OK: note already matches ${summary.indexPath}.`,
				8000,
			);
		} else {
			new Notice(
				summary.updated
					? `Pulled and overwrote note from ${summary.indexPath}.`
					: `Note already up to date with ${summary.indexPath}.`,
				8000,
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Blog repository pull failed.", error);
		new Notice(`Blog repository pull failed: ${message}`, 10000);
	} finally {
		state.isPulling = false;
		plugin.clearStatus();
	}
}
