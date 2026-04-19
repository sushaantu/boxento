---
name: pull
description:
  Pull latest origin/main into the current local branch and resolve merge
  conflicts (aka update-branch). Use when Codex needs to sync a feature branch
  with origin, perform a merge-based update, and resolve conflicts safely.
---

# Pull

## Workflow

1. Verify the git status is clean or commit/stash changes before merging.
2. Ensure rerere is enabled locally:
   - `git config rerere.enabled true`
   - `git config rerere.autoupdate true`
3. Confirm remotes and branches:
   - Ensure the `origin` remote exists.
   - Ensure the current branch is the one to receive the merge.
4. Fetch latest refs:
   - `git fetch origin`
5. Sync the remote feature branch first:
   - `git pull --ff-only origin $(git branch --show-current)`
6. Merge `origin/main`:
   - Prefer `git -c merge.conflictstyle=zdiff3 merge origin/main`
7. If conflicts appear, resolve them, then stage the resolved files and complete the merge.
8. Verify with project checks appropriate to the scope.
9. Summarize the merge, including the main conflicts and how they were resolved.

## Conflict guidance

- Inspect context before editing with `git status`, `git diff`, and file-level diffs.
- Decide the final behavior before editing conflict markers.
- Prefer minimal, intention-preserving edits.
- Resolve one file at a time and rerun checks after each logical batch.
- For generated files, resolve source conflicts first and regenerate if needed.
- After resolving, ensure no conflict markers remain with `git diff --check`.

## Ask the user only when necessary

Ask only when the correct resolution depends on product intent that is not inferable from code, tests, or nearby documentation, or when the conflict would introduce irreversible risk without an obvious safe default.

