import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { normalizeSettings, type BlogPushSettings } from "./settings";
import { BlogPushSettingTab } from "./ui/settings-tab";

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
		this.settings = normalizeSettings(await this.loadData());
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
