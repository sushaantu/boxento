# Playwright E2E In Sandboxed Codex Sessions

## Problem Summary

On this machine's current macOS Codex sandbox, Boxento's browser E2E suite hits two independent platform restrictions before any app assertion runs:

- Playwright cannot start its own Vite server because binding `127.0.0.1` fails with `listen EPERM`.
- Browser launch aborts before a context is created. The direct Chrome for Testing probe exits with `SIGABRT`, and Playwright then reports `browserType.launch: Target page, context or browser has been closed`.

That means a self-contained `bun run test:e2e` invocation inside the sandbox is not a viable path today, even when the Boxento implementation and static build are correct.

## Current Result On This Machine

There is no fully sandbox-compatible Playwright execution path in the current Codex/macOS shell profile on this machine.

Validated constraints:

- local web-server bind fails with `listen EPERM`
- local browser launch fails with `SIGABRT`
- loopback websocket/TCP connect also fails with `EPERM`, so `browserType.connect()` to a same-machine browser server is blocked too

That means the practical requirement today is an environment change, not another Playwright flag.

## What Still Helps

The repo now supports remote-browser configuration for future or less-restricted environments:

- `scripts/start-playwright-server.mjs`
- `PLAYWRIGHT_CONNECT_WS_ENDPOINT`
- `PLAYWRIGHT_CONNECT_WS_ENDPOINT_FILE`
- `PLAYWRIGHT_CONNECT_EXPOSE_NETWORK`

Those hooks are useful if a future Codex session can open outbound TCP connections to the browser endpoint. In the current shell profile, even a fake `ws://127.0.0.1:<port>` endpoint fails immediately with `connect EPERM`.

## Required Environment Changes

To run Boxento browser E2E reliably in unattended Codex sessions on this machine, the environment must allow all of the following:

- launching a browser process from the session
- binding a local dev server or otherwise serving the app to the browser
- opening outbound TCP connections to the Playwright browser endpoint

Without those capabilities, the browser suite has to run outside the sandbox.

## Practical Workflow Today

Run the browser E2E command from a normal host shell, CI runner, or another execution environment that permits browser launch plus socket I/O.

Example host-shell flow:

```bash
bun install
bun run build
bun run test:e2e -- tests/e2e/dashboard-switching.spec.ts --workers=1
```

## Fail-Fast Behavior

`scripts/run-playwright.mjs` now performs a lightweight preflight before invoking Playwright:

- loopback bind check when Playwright would otherwise start its own web server
- websocket endpoint reachability check when `PLAYWRIGHT_CONNECT_WS_ENDPOINT` or `PLAYWRIGHT_CONNECT_WS_ENDPOINT_FILE` is configured
- local browser launch check when no remote websocket endpoint is configured

If any prerequisite is unavailable, the runner exits immediately with guidance that points back to this document instead of waiting for the opaque `SIGABRT`, `Target page, context or browser has been closed`, or late websocket connection failure paths.

Set `PLAYWRIGHT_SKIP_ENV_CHECK=1` to bypass those checks when you need the old behavior.

## Unsupported Path In The Current Sandbox

The following combinations remain unsupported in the current Codex/macOS sandbox on this machine:

- Playwright launches a browser locally inside the sandbox.
- Playwright launches its own localhost web server inside the sandbox.
- Playwright connects to a browser websocket endpoint bound on loopback from inside the sandbox.

Until the sandbox profile changes to allow browser launch plus the necessary socket access, Boxento E2E validation has to move outside this sandbox.
