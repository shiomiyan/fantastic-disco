import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { DEFAULT_SETTINGS } from "./settings";
import { BlogPushSettingTab } from "./ui/settings-tab";
import type { BlogPushSettings } from "./types";

export default class BlogPushPlugin extends Plugin {
	settings!: BlogPushSettings;
	private statusBarItemEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();
		this.statusBarItemEl = this.addStatusBarItem();
		this.statusBarItemEl.hide();

		registerCommands(this);
		this.addSettingTab(new BlogPushSettingTab(this.app, this));
	}

	onunload() {
		this.statusBarItemEl = null;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BlogPushSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	setStatus(text: string): void {
		this.statusBarItemEl?.setText(text);
		this.statusBarItemEl?.show();
	}

	clearStatus(): void {
		this.statusBarItemEl?.setText("");
		this.statusBarItemEl?.hide();
	}
}
