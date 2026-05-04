import { runFillMetadata } from "./fill-metadata";
import { runPushCurrentNote } from "./push-current-note";
import type BlogPushPlugin from "../main";

export function registerCommands(plugin: BlogPushPlugin): void {
	const pushState = {
		isPushing: false,
	};

	plugin.addCommand({
		id: "fill-current-note-blog-metadata",
		name: "Fill current note blog ID and slug",
		callback: () => {
			void runFillMetadata(plugin);
		},
	});

	plugin.addCommand({
		id: "push-current-note-to-blog",
		name: "Push current note to blog",
		callback: () => {
			void runPushCurrentNote(plugin, pushState, false);
		},
	});

	plugin.addCommand({
		id: "dry-run-push-current-note-to-blog",
		name: "Dry run push current note to blog",
		callback: () => {
			void runPushCurrentNote(plugin, pushState, true);
		},
	});
}
