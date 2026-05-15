import { App } from "obsidian";

export function loadGithubToken(app: App, secretName: string): string {
	const normalizedName = secretName.trim();
	if (!normalizedName) {
		throw new Error("Set a GitHub token secret in plugin settings.");
	}

	const token = app.secretStorage.getSecret(normalizedName);
	if (!token) {
		throw new Error("GitHub token secret is empty or missing.");
	}

	return token;
}
