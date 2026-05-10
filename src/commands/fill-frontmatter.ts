import { MarkdownView, Notice, TFile } from "obsidian";
import { fillFrontmatter } from "../frontmatter";
import type BlogPushPlugin from "../main";

export async function runFillFrontmatter(plugin: BlogPushPlugin): Promise<void> {
	try {
		const file = getActiveMarkdownFile(
			plugin,
			"Open a Markdown note before filling frontmatter.",
		);
		const result = await fillFrontmatter(plugin.app, file);
		if (!result.generatedId && !result.generatedSlug) {
			new Notice("Frontmatter ID and slug are already set.");
			return;
		}

		const generated = [
			result.generatedId ? "id" : null,
			result.generatedSlug ? "slug" : null,
		].filter((value): value is string => value !== null);
		new Notice(`Filled frontmatter ${generated.join(" and ")}.`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Frontmatter fill failed.", error);
		new Notice(`Frontmatter fill failed: ${message}`, 10000);
	}
}

function getActiveMarkdownFile(plugin: BlogPushPlugin, errorMessage: string): TFile {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	if (!file || file.extension !== "md") {
		throw new Error(errorMessage);
	}
	return file;
}
