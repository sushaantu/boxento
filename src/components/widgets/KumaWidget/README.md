# Uptime Kuma Widget

Display service monitor status from an Uptime Kuma instance inside Boxento.

## What It Shows

- Service status (`Up`, `Down`, `Pending`, `Maintenance`)
- Response time from the latest heartbeat
- Last check time
- 24-hour uptime percentage when available

## Configuration

- `Title`: widget header label
- `Status Page URL`: the public Uptime Kuma status page to read from
- `API URL`: advanced override for the Boxento backend endpoint
- `Open URL`: optional override for the external-link button
- `Refresh (s)`: polling interval, minimum practical value is 15 seconds
- `Item limit`: optional cap on monitors shown in standard layouts; leave blank for the size-aware default
- `Group filter`: optional text match against Kuma groups
- `Status filter`: show all monitors, only issues, or only healthy monitors
- `Show groups`: toggle group labels in each row
- `Show messages`: toggle latest status messages in each row

## Expected API Shape

The widget expects a JSON response shaped like:

```json
{
  "dashboardUrl": "https://monitoring.example.com/status/homelab",
  "monitors": [
    {
      "id": 1,
      "name": "Paisa",
      "group": "Finance",
      "type": "http",
      "status": "up",
      "ping": 42,
      "message": "200 - OK",
      "lastChecked": "2026-03-13T17:00:00.000Z",
      "uptime24": 0.998
    }
  ],
  "summary": {
    "total": 1,
    "up": 1,
    "down": 0,
    "pending": 0,
    "maintenance": 0
  },
  "updatedAt": "2026-03-13T17:00:00.000Z"
}
```

## Notes

- The widget is intended for visibility, not alerting.
- Fresh Boxento installs can configure this widget directly from widget settings using a status page URL.
- For hosted or self-hosted homelabs, pair it with actual notifications from Uptime Kuma itself.
