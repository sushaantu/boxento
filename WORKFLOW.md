---
# Minimum recommended Linear states for this workflow:
# - Todo
# - In Progress
# - In Review
# - Done
# If your team uses different labels, replace the state names below.
tracker:
  kind: linear
  project_slug: "boxento-40fc92f12c05"
  active_states:
    - Todo
    - In Progress
    - In Review
  terminal_states:
    - Done
    - Cancelled
    - Canceled
    - Duplicate
polling:
  interval_ms: 5000
workspace:
  root: ~/code/symphony-workspaces/boxento
hooks:
  after_create: |
    git clone --depth 1 https://github.com/sushaantu/boxento.git .
    ./.codex/worktree_init.sh
agent:
  max_concurrent_agents: 5
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config model_reasoning_effort=xhigh --model gpt-5.3-codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
---

You are working on a Linear ticket `{{ issue.identifier }}` for the Boxento app.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} because the ticket is still in an active state.
- Resume from the current workspace state instead of restarting from scratch.
- Do not repeat already-completed investigation or validation unless needed for new code changes.
- Do not end the turn while the ticket remains in an active state unless blocked by missing required permissions, auth, or secrets.
{% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Instructions:

1. This is an unattended orchestration session. Never ask a human to perform follow-up actions unless blocked by missing required access or secrets.
2. Final messages should report completed actions and blockers only. Do not include "next steps for user".
3. Work only in the provided repository copy. Do not touch any other path.

## Repo specifics

- Package manager: `bun`
- Primary app root: repository root
- Local development server: `bun run dev`
- Validation baseline: `bun run lint`, `bun run test`, `bun run test:e2e`
- Boxento supports local-only mode. Firebase-related env vars are optional unless the task explicitly touches cloud sync or auth flows.

## Linear tool requirement

The agent should be able to talk to Linear, either via a configured Linear MCP server or Symphony's injected `linear_graphql` tool. If neither is present, stop and report that Linear integration is missing.

## Default posture

- Start by determining the ticket's current status and route to the matching flow.
- Use a single persistent `## Codex Workpad` comment as the source of truth for progress and validation.
- Reproduce first whenever there is an existing bug or failing behavior.
- Keep issue metadata current and keep the workpad updated after each meaningful milestone.
- Treat ticket-authored `Validation`, `Test Plan`, or `Testing` sections as required acceptance input.
- Keep scope tight. If you find additional worthwhile work, open a follow-up Linear ticket instead of expanding the current one.

## Related skills

- `linear`: interact with Linear through raw GraphQL operations.
- `commit`: produce a clean commit with rationale.
- `pull`: merge the latest `origin/main` into the branch when needed.
- `push`: publish the branch and create or update the PR.
- `land`: merge an approved PR after checks pass.

## Status map

- `Backlog` or other non-active planning states -> out of scope for this workflow; do not modify.
- `Todo` -> queued; immediately transition to `In Progress` before active work.
- `In Progress` -> implementation actively underway.
- `In Review` -> a PR should exist; wait for human review, address review feedback if present, and merge only after approval plus green checks.
- `Done` -> terminal state; no further action required.

If your Linear team uses different names, update both the YAML front matter and these status references before running Symphony.

## Step 0: Determine current ticket state and route

1. Fetch the issue by explicit ticket ID.
2. Read the current state.
3. Route to the matching flow:
   - `Todo` -> move to `In Progress`, then begin execution.
   - `In Progress` -> continue execution flow.
   - `In Review` -> do not start new feature work; first inspect PR status and review feedback.
   - `Done` or any terminal state -> do nothing and shut down.
   - Any other non-active state -> stop and wait for a human to move the ticket into an active state.
4. Check whether a PR already exists for the current branch and whether it is closed.
   - If a branch PR exists and is `CLOSED` or `MERGED`, create a fresh branch from `origin/main` before resuming implementation.

## Step 1: Start or continue execution

1. Find or create a single persistent scratchpad comment for the issue with the header `## Codex Workpad`.
2. Reconcile the workpad before any new edits:
   - Check off items already completed.
   - Update the plan so it reflects the actual remaining scope.
   - Ensure `Acceptance Criteria` and `Validation` sections are current.
3. Include a compact environment stamp near the top:
   - Format: `<host>:<abs-workdir>@<short-sha>`
4. Add or update checklist sections for:
   - Plan
   - Acceptance Criteria
   - Validation
   - Notes
5. Capture a concrete reproduction signal before implementation when applicable.
6. Sync with `origin/main` before code edits if the branch is stale or if the ticket resumes after time away.

## Step 2: Execution phase

1. Determine current repo state: branch, `git status`, and `HEAD`.
2. Implement against the workpad checklist and keep the comment current as reality changes.
3. Run validation appropriate to the scope.
   - Minimum default validation for app changes: `bun run lint`, `bun run test`
   - Run `bun run test:e2e` for user-facing flow changes, routing changes, widget behavior changes, or other browser-observable work.
4. Before every `git push`, rerun the required validation for the current scope.
5. Ensure a PR exists for the branch and attach its URL to the Linear issue.
6. Move the ticket to `In Review` only when:
   - required validation is complete,
   - the PR is updated,
   - the workpad reflects the final plan and validation state.

## PR feedback sweep protocol

When a ticket has an attached PR, gather feedback from all channels before considering the work ready:

1. Top-level PR comments.
2. Inline review comments.
3. Review summaries and approval state.

Treat every actionable reviewer comment as blocking until it is either addressed in code or answered with explicit, justified pushback.

## Step 3: In Review handling

1. When the issue is in `In Review`, do not continue feature work by default.
2. Poll the PR for review state, review comments, and CI checks.
3. If review feedback requests changes:
   - reply inline,
   - move the issue back to `In Progress`,
   - implement the requested changes,
   - rerun validation,
   - update the PR,
   - return the issue to `In Review`.
4. If approval is present and checks are green, use the `land` skill to merge the PR.
5. After merge succeeds, move the issue to `Done`.

## Completion bar before moving to In Review

- The implementation matches the ticket scope.
- Required validation is complete and recorded in the workpad.
- The PR is up to date with the latest branch changes.
- No actionable PR comments remain unresolved.
- The workpad includes concise handoff notes, including commit SHA and validation summary.
