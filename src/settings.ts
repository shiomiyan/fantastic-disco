import {App, PluginSettingTab, SecretComponent, Setting} from "obsidian";
import BlogPushPlugin from "./main";
import type {BlogPushSettings} from "./types";

export const DEFAULT_SETTINGS: BlogPushSettings = {
	githubTokenSecret: "",
	owner: "shiomiyan",
	repo: "blog",
	pushBranch: "obsidian",
	baseBranch: "master",
	postsDirectory: "src/content/posts",
};

export class BlogPushSettingTab extends PluginSettingTab {
	plugin: BlogPushPlugin;

	constructor(app: App, plugin: BlogPushPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("GitHub token")
			.setDesc("Select the secret that stores your token.")
			.then((setting) => {
				new SecretComponent(this.app, setting.controlEl)
					.setValue(this.plugin.settings.githubTokenSecret)
					.onChange((value: string) => {
						this.plugin.settings.githubTokenSecret = value;
						void this.plugin.saveSettings();
				});
			});

		this.addTextSetting("Owner", "GitHub repository owner.", "owner");
		this.addTextSetting("Repository", "GitHub repository name.", "repo");
		this.addTextSetting("Push branch", "Branch updated by this plugin.", "pushBranch");
		this.addTextSetting("Base branch", "Branch used when the push branch does not exist.", "baseBranch");
		this.addTextSetting("Posts directory", "Blog content directory for posts.", "postsDirectory");
	}

	private addTextSetting(name: string, description: string, key: keyof BlogPushSettings): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => text
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					this.plugin.settings[key] = value.trim();
					await this.plugin.saveSettings();
				}));
	}
}
