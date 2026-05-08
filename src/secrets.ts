import { App } from "obsidian";

export function loadRequiredSecret(app: App, secretName: string): string {
	if (!secretName.trim()) {
		throw new Error("Set a GitHub token secret in plugin settings.");
	}

	const token = app.secretStorage.getSecret(secretName);
	if (!token) {
		throw new Error("GitHub token secret is empty or missing.");
	}

	return token;
}
