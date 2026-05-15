# Blogger

Blogger is an Obsidian plugin for pushing the current Markdown note to `shiomiyan/blog` through the GitHub Git Data API.

It creates one Git commit on the configured push branch. The default target is:

- Repository: `shiomiyan/blog`
- Push branch: `obsidian`
- Base branch: `main`
- Posts directory: `src/content/posts`

## Frontmatter

The note must include complete blog frontmatter before it can be pushed:

```yaml
---
title: Example post
description: ""
created: 2026-04-26T07:15:30.000Z
draft: true
id: 00000000-0000-4000-8000-000000000000
categories:
    - diary
tags: []
slug: 20260426-161530
---
```

`slug` is used only to choose the GitHub path:

```text
src/content/posts/<slug>/index.md
```

Only the frontmatter keys required by the blog schema are sent.

## Commands

Use these commands from the Obsidian command palette:

| Command                                            | ID                                               | Description                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fill current note frontmatter**                  | `fill-current-note-frontmatter`                  | Add missing or empty `id` and `slug` fields to the active Markdown note frontmatter.                                                                     |
| **Push current note to blog repository**           | `push-current-note-to-blog-repository`           | Validate the active Markdown note, resolve images, and push the post to the configured blog repository.                                                  |
| **Dry run push current note to blog repository**   | `dry-run-push-current-note-to-blog-repository`   | Validate the active Markdown note, resolve images, check the GitHub branch and existing post ID, and report what would change without creating a commit. |
| **Pull current note from blog repository**         | `pull-current-note-from-blog-repository`         | Force pull the remote post for the note slug from the push branch and overwrite the local note content after creating a `.bak` backup.                   |
| **Dry run pull current note from blog repository** | `dry-run-pull-current-note-from-blog-repository` | Check whether force pull would overwrite the local note and report the remote `index.md` path without changing the note.                                 |

The fill command keeps existing values. It generates `id` as a UUID and generates `slug` from `created` as `YYYYMMDD-HHmmss` when possible, falling back to the note name.

## Images

The plugin supports Obsidian image embeds and Markdown image links:

```md
![[Pasted image.png]]
![Alt](attachments/photo.jpg)
```

Images are copied into the post directory and links are rewritten to `./filename.ext`.

Supported image extensions:

```text
.png .jpg .jpeg .gif .webp .avif .svg
```

Limits:

- 5MB per image
- 20MB total per push

Non-image wiki links such as `[[Other note]]` stop the push.

## GitHub token

Create a fine-grained PAT scoped to the target repository with **Contents: Read and write**.

Store it with Obsidian SecretStorage from the plugin settings, then select that secret for GitHub requests.

## Development

This project uses pnpm, Node.js 24+, Rolldown for bundling, Oxfmt for formatting, Oxlint for linting, and TypeScript for type checking.

```bash
pnpm install
pnpm run fmt:check
pnpm run typecheck
pnpm run lint
pnpm run build
```

Use watch mode while developing:

```bash
pnpm run dev
```

Release artifacts are emitted at the plugin root as `main.js`, `manifest.json`, and `styles.css`.
