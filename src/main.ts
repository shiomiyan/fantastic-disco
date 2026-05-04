import {MarkdownView, Notice, Plugin, TFile} from "obsidian";
import {fillPostMetadata} from "./frontmatter";
import {BlogPushSettingTab, DEFAULT_SETTINGS} from "./settings";
import {pushCurrentNote, summarizeSuccess, notifyWarnings} from "./push";
import {BlogPushSettings} from "./types";

export default class BlogPushPlugin extends Plugin {
	settings!: BlogPushSettings;
	private statusBarItemEl: HTMLElement | null = null;
	private isPushing = false;

	async onload() {
		await this.loadSettings();
		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.hide();

		this.addCommand({
			id: "fill-current-note-blog-metadata",
			name: "Fill current note blog ID and slug",
			callback: () => {
				void this.runFillMetadata();
			},
		});

		this.addCommand({
			id: "push-current-note-to-blog",
			name: "Push current note to blog",
			callback: () => {
				void this.runPush(false);
			},
		});

		this.addCommand({
			id: "dry-run-push-current-note-to-blog",
			name: "Dry run push current note to blog",
			callback: () => {
				void this.runPush(true);
			},
		});

		this.addSettingTab(new BlogPushSettingTab(this.app, this));
	}

	onunload() {
		this.statusBarItemEl = null;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<BlogPushSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async runFillMetadata(): Promise<void> {
		try {
			const file = this.getActiveMarkdownFile("Open a Markdown note before filling blog metadata.");
			const source = await this.app.vault.read(file);
			const result = fillPostMetadata(source, file.basename);
			if (!result.generatedId && !result.generatedSlug) {
				new Notice("Blog ID and slug are already set.");
				return;
			}

			await this.app.vault.modify(file, result.source);
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

	private async runPush(dryRun: boolean): Promise<void> {
		if (this.isPushing) {
			new Notice("Blog push is already running.");
			return;
		}

		this.isPushing = true;
		this.setStatus(dryRun ? "Checking blog push..." : "Pushing to blog...");
		new Notice(dryRun ? "Preparing dry run blog push..." : "Preparing blog push...");

		try {
			const summary = await pushCurrentNote(this.app, this.settings, dryRun);
			notifyWarnings(summary);
			new Notice(summarizeSuccess(summary, this.settings.pushBranch), 8000);
			if (summary.commitUrl) {
				console.debug("Blog push commit:", summary.commitUrl);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("Blog push failed.", error);
			new Notice(`Blog push failed: ${message}`, 10000);
		} finally {
			this.isPushing = false;
			this.clearStatus();
		}
	}

	private getActiveMarkdownFile(errorMessage: string): TFile {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;
		if (!file || file.extension !== "md") {
			throw new Error(errorMessage);
		}
		return file;
	}

	private setStatus(text: string): void {
		this.statusBarItemEl?.setText(text);
		this.statusBarItemEl?.show();
	}

	private clearStatus(): void {
		this.statusBarItemEl?.setText("");
		this.statusBarItemEl?.hide();
	}
}
