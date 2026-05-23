# Tailscale Serve Widget

Display active Tailscale Serve URLs from the self-hosted Boxento backend.

## Features

- Lists every active Tailscale Serve web route
- Shows the public tailnet URL and the local proxy target
- Separates localhost, LAN, tailnet, OrbStack, remote, static, and unknown targets
- Provides copy and open actions for each route
- Supports tiny, compact, standard, and large dashboard sizes

## Backend

The widget reads from:

```text
GET /api/tailscale/serve
```

The backend is read-only. It can load route data from one of these sources:

- `tailscale serve status --json` when the Tailscale CLI is available to the backend process
- `TAILSCALE_SERVE_STATUS_URL`
- `TAILSCALE_SERVE_STATUS_FILE`
- `TAILSCALE_SERVE_STATUS_JSON`

## Settings

- `Title`: widget title
- `API URL`: optional backend endpoint override
- `Refresh seconds`: polling interval, minimum 15 seconds
- `Max rows`: optional row limit
- `Show targets`: toggles proxy target details in compact widget states

## Responsive Sizing

- `1x1`: active Serve route count
- Short row: route count plus quick port chips
- Compact: active and HTTPS counts plus the most important routes
- Standard: route cards with copy/open actions
- Large/app: summary metrics, search, target-type filter, and a route table
