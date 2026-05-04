import { MarkdownView, Notice, TFile } from "obsidian";
import { fillPostMetadata } from "../frontmatter";
import type BlogPushPlugin from "../main";

export async function runFillMetadata(plugin: BlogPushPlugin): Promise<void> {
	try {
		const file = getActiveMarkdownFile(
			plugin,
			"Open a Markdown note before filling blog metadata.",
		);
		const result = await fillPostMetadata(plugin.app, file);
		if (!result.generatedId && !result.generatedSlug) {
			new Notice("Blog ID and slug are already set.");
			return;
		}

		const generated = [
			result.generatedId ? "id" : null,
			result.generatedSlug ? "slug" : null,
		].filter((value): value is string => value !== null);
		new Notice(`Filled blog ${generated.join(" and ")}.`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Blog metadata fill failed.", error);
		new Notice(`Blog metadata fill failed: ${message}`, 10000);
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
