import {Notice, Plugin} from "obsidian";
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

	private setStatus(text: string): void {
		this.statusBarItemEl?.setText(text);
		this.statusBarItemEl?.show();
	}

	private clearStatus(): void {
		this.statusBarItemEl?.setText("");
		this.statusBarItemEl?.hide();
	}
}
