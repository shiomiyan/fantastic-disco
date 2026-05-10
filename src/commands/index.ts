import { runFillFrontmatter } from "./fill-frontmatter";
import { runPushCurrentNote } from "./push-current-note";
import { runPullCurrentNote } from "./pull-current-note";
import type BlogPushPlugin from "../main";

export function registerCommands(plugin: BlogPushPlugin): void {
	const pushState = {
		isPushing: false,
	};
	const pullState = {
		isPulling: false,
	};

	plugin.addCommand({
		id: "fill-current-note-frontmatter",
		name: "Fill current note frontmatter",
		callback: () => {
			void runFillFrontmatter(plugin);
		},
	});

	plugin.addCommand({
		id: "push-current-note-to-blog-repository",
		name: "Push current note to blog repository",
		callback: () => {
			void runPushCurrentNote(plugin, pushState, false);
		},
	});

	plugin.addCommand({
		id: "dry-run-push-current-note-to-blog-repository",
		name: "Dry run push current note to blog repository",
		callback: () => {
			void runPushCurrentNote(plugin, pushState, true);
		},
	});

	plugin.addCommand({
		id: "pull-current-note-from-blog-repository",
		name: "Pull current note from blog repository",
		callback: () => {
			void runPullCurrentNote(plugin, pullState, false);
		},
	});

	plugin.addCommand({
		id: "dry-run-pull-current-note-from-blog-repository",
		name: "Dry run pull current note from blog repository",
		callback: () => {
			void runPullCurrentNote(plugin, pullState, true);
		},
	});
}
