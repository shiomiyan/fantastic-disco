# Blog Push

Blog Push is an Obsidian plugin for pushing the current Markdown note to `shiomiyan/blog` through the GitHub Git Data API.

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
category: diary
tags: []
slug: 20260426-161530
---
```

`slug` is used only to choose the GitHub path:

```text
src/content/posts/<slug>/index.md
```

The pushed Markdown frontmatter keeps only the keys required by the blog schema. Obsidian-only metadata is not sent.

## Commands

Use these commands from the Obsidian command palette:

| Command | ID | Description |
| --- | --- | --- |
| **Fill current note blog ID and slug** | `fill-current-note-blog-metadata` | Add missing or empty `id` and `slug` fields to the active Markdown note. |
| **Push current note to blog** | `push-current-note-to-blog` | Validate the active Markdown note, resolve images, and push the post to the configured GitHub repository. |
| **Dry run push current note to blog** | `dry-run-push-current-note-to-blog` | Validate the active Markdown note, resolve images, check the GitHub branch and existing post ID, and report what would change without creating a commit. |

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
