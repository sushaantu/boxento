# Tennis widget

Add Tennis from the Information category. Open its settings and paste your free Live Tennis API key.
The widget shows score snapshots for current matches. Scores refresh every 15 minutes.

The API key uses Boxento's existing encrypted shared credential store. It stays in this browser and is excluded from shared dashboard configuration.
Each browser viewing a shared dashboard needs its own credentials. The snapshot cache contains a hash of the key, without its value.
A snapshot is shared by widgets that use identical credentials. Browser tabs on the same origin share a persisted request limit through Web Locks.
Manual refresh cannot send a request sooner than 15 minutes after the last attempt. The limit survives reloads and resizing. Failed requests also count.
This permits at most 96 attempts per day within the free allowance of 100 requests.
This limit applies to one browser profile and origin. Requests from other devices or applications using those credentials also consume the free allowance.

The widget calls `GET /matches?status=live` with the `X-API-Key` header.
It displays one page of matches. It does not call paid endpoints.
Browser storage and Web Locks must be available. If either fails, the widget pauses requests and displays an error.
Clearing browser data resets the local request history.

## Sizes and states

A 1x1 widget shows the match count. A short row adds the first matchup.
Compact widgets show the first match, sets won and current points. Standard widgets add per-set scores and tournament names.
Panels and larger widgets add a local search over players and tournaments. Filtering uses the cached snapshot.

The widget shows loading placeholders, an empty match state and scoped errors.
A failed refresh keeps the previous scores with their original timestamp. Unknown scores display as unavailable.
Read-only dashboards hide settings and refresh controls. Delete remains in the settings footer.

## Checks

Run `bun run test`, `bun run build` and `bun run test:e2e` from the repository root.
Unit and browser tests use API fixtures. A real authenticated request requires an existing API key.
The response fields follow the [API specification](https://docs.livetennisapi.com/openapi.yaml).
