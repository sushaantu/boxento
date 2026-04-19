---
name: land
description:
  Land a PR by monitoring conflicts, resolving them, waiting for checks, and
  squash-merging when green; use when asked to land, merge, or shepherd a PR to
  completion.
---

# Land

## Goals

- Ensure the PR is conflict-free with `main`.
- Keep CI green and fix failures when they occur.
- Squash-merge the PR once checks pass.
- Do not yield until the PR is merged unless blocked.

## Preconditions

- `gh` CLI is authenticated.
- You are on the PR branch with a clean working tree.

## Steps

1. Locate the PR for the current branch.
2. Confirm the full gauntlet is green locally before any push:
   - `bun run lint`
   - `bun run test`
   - `bun run test:e2e` for user-facing changes
3. If the working tree has uncommitted changes, commit with the `commit` skill and push with the `push` skill before proceeding.
4. Check mergeability and conflicts against `main`.
5. If conflicts exist, use the `pull` skill to merge `origin/main`, resolve conflicts, and then use the `push` skill to publish the updated branch.
6. Ensure review comments are acknowledged and any required fixes are handled before merging.
7. Watch checks until complete.
8. If checks fail, inspect logs, fix the issue, commit, push, and restart the watch.
9. When all checks are green and review feedback is addressed, squash-merge the PR.

## Commands

```sh
branch=$(git branch --show-current)
pr_number=$(gh pr view --json number -q .number)
pr_title=$(gh pr view --json title -q .title)
pr_body=$(gh pr view --json body -q .body)
mergeable=$(gh pr view --json mergeable -q .mergeable)

if [ "$mergeable" = "CONFLICTING" ]; then
  echo "Run the pull skill, resolve conflicts, then push the branch again."
  exit 1
fi

python3 .codex/skills/land/land_watch.py

gh pr merge --squash --subject "$pr_title" --body "$pr_body"
```

## Failure handling

- If checks fail, inspect `gh pr checks` and `gh run view --log`, fix the issue locally, commit, push, and rerun the watch.
- If mergeability is `UNKNOWN`, wait and re-check.
- Do not merge while actionable review comments remain unresolved.

