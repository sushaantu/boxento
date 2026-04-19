---
name: push
description:
  Push current branch changes to origin and create or update the corresponding
  pull request; use when asked to push, publish updates, or create a pull request.
---

# Push

## Prerequisites

- `gh` CLI is installed and available in `PATH`.
- `gh auth status` succeeds for GitHub operations in this repo.

## Goals

- Push current branch changes to `origin` safely.
- Create a PR if none exists for the branch, otherwise update the existing PR.
- Keep branch history clean when remote has moved.

## Related skills

- `pull`: use this when push is rejected or the branch is stale.

## Validation gate

Run the checks that match the repo's normal contribution flow before pushing:

```sh
bun run lint
bun run test
```

Run browser coverage too when the change is user-facing, routing-related, or otherwise browser-observable:

```sh
bun run test:e2e
```

If Playwright browsers are missing, install them first:

```sh
bunx playwright install --with-deps chromium
```

## Steps

1. Identify the current branch and confirm the remote state.
2. Run the required validation for the scope.
3. Push the branch to `origin` with upstream tracking if needed.
4. If push is rejected because the remote moved, run the `pull` skill, rerun validation, and push again.
5. If push fails because of auth, permissions, or repo rules, stop and surface the exact error.
6. Ensure a PR exists for the branch:
   - If no PR exists, create one.
   - If a PR exists and is open, update it.
   - If the current branch is tied to a closed or merged PR, create a fresh branch and PR.
7. Write or update a clear PR title and body that match the current diff.
8. Reply with the PR URL from `gh pr view`.

## Commands

```sh
branch=$(git branch --show-current)

git push -u origin HEAD

pr_state=$(gh pr view --json state -q .state 2>/dev/null || true)
if [ "$pr_state" = "MERGED" ] || [ "$pr_state" = "CLOSED" ]; then
  echo "Current branch is tied to a closed PR; create a new branch + PR." >&2
  exit 1
fi

pr_title="<clear PR title written for this change>"
if [ -z "$pr_state" ]; then
  gh pr create --fill --title "$pr_title"
else
  gh pr edit --title "$pr_title"
fi

gh pr view --json url -q .url
```

## Notes

- Do not use `--force`; use `--force-with-lease` only when local history was intentionally rewritten.
- Distinguish sync problems from auth or permission problems. Use the `pull` skill for the former and surface the latter directly.

