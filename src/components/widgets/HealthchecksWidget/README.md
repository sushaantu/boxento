# Healthchecks Widget

Display scheduled job and dead-man-switch status from Healthchecks inside Boxento.

## What It Shows

- Check status (`Up`, `Late`, `Grace`, `Down`, `Paused`, `New`)
- Last run time
- Last recorded duration
- Grace window

## Configuration

- `Title`: widget header label
- `Healthchecks URL`: base URL of your Healthchecks instance
- `Read-only API Key`: API key used to fetch checks
- `API URL`: advanced override for the Boxento backend endpoint
- `Open URL`: optional override for the external-link button
- `Refresh (s)`: polling interval, minimum practical value is 15 seconds
- `Item limit`: optional cap on checks shown in standard layouts; leave blank for the size-aware default
- `Tag filter`: optional text match against Healthchecks tags
- `Status filter`: show all checks, only checks needing attention, or only healthy checks
- `Show tags`: toggle tag labels in each row
- `Show descriptions`: toggle check descriptions in each row

## Expected API Shape

The widget expects a JSON response shaped like:

```json
{
  "dashboardUrl": "https://healthchecks.example.com",
  "checks": [
    {
      "name": "finance-sync",
      "slug": "finance-sync",
      "tags": "finance,mac-mini",
      "description": "Nightly import",
      "status": "up",
      "started": false,
      "lastPing": "2026-03-13T03:00:00.000Z",
      "nextPing": "2026-03-14T03:00:00.000Z",
      "lastDuration": 48,
      "graceSeconds": 3600,
      "timeoutSeconds": 3600
    }
  ],
  "summary": {
    "total": 1,
    "up": 1,
    "down": 0,
    "grace": 0,
    "late": 0,
    "new": 0,
    "paused": 0
  },
  "updatedAt": "2026-03-13T17:00:00.000Z"
}
```

## Notes

- This widget is best for jobs and cron-like workflows, not live service uptime.
- Fresh Boxento installs can configure this widget directly from widget settings using the instance URL and a read-only API key.
- Pair it with Uptime Kuma for a full homelab monitoring setup.
