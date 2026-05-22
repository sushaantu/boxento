# Performance Readiness

Boxento should support thousands of saved widgets without mounting, polling, and saving all of them at once.

## Benchmark Command

Run the production dashboard benchmark:

```bash
bun run perf:dashboard
```

Useful variants:

```bash
bun run perf:dashboard -- --counts=100,500,1000
bun run perf:dashboard -- --counts=1000 --add-widget=false
bun run perf:dashboard -- --base-url=http://127.0.0.1:5173/
```

The benchmark seeds browser storage, loads the dashboard, waits for the grid to become usable, measures DOM/memory, and optionally adds one Notes widget through the real UI.

## Current Baseline

Measured on the production build after introducing deferred offscreen mounting, a shared visibility observer, CSS offscreen containment, append placement, and changed-config-only saves:

| Saved widgets | Ready | Add widget | DOM nodes | Mounted widgets | Storage reads/writes on add |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 488 ms | 115 ms | 811 | 20 | 1 / 3 |
| 500 | 503 ms | 101 ms | 2,411 | 20 | 1 / 3 |
| 1,000 | 614 ms | 228 ms | 4,411 | 20 | 1 / 3 |
| 2,000 | 765 ms | 383 ms | 8,411 | 20 | 1 / 3 |

The 1,000-widget target is now met. At 2,000 widgets, add latency is much better but still above the 300 ms target, mostly because the dashboard still renders every grid wrapper.

## Targets

- 1,000 saved widgets become usable in under 2 seconds.
- Adding one widget to a 1,000-widget dashboard completes in under 300 ms.
- Widget selector with 5,000 available widgets opens in under 200 ms and searches in under 100 ms.
- Only visible or recently used widgets are mounted; target 50-150 mounted widgets.
- No storage or layout operation blocks the main thread for more than 100 ms.
- API widgets use a shared refresh scheduler with endpoint dedupe and no more than 25 concurrent requests.

## Next Performance Ceiling

The next meaningful step is grid virtualization or paging at the dashboard-item layer. Deferred mounting stops widget internals from loading, but `react-grid-layout` still owns every wrapper, so add and layout work still grows with saved widget count.

## Widget And Layout Audit Checks

- Performance work must preserve existing widget visuals. Do not add new hover effects, shadows, borders, transitions, or visual treatments unless the change directly fixes clipping, overflow, or a broken recovery path.
- Compact and one-column widgets must not show clipped headers like `Weat...`; hide the standard header when the title and controls cannot fit.
- Wide and 4K-class viewports must use the available dashboard canvas and the matching wide breakpoint instead of capping the grid at laptop width.
- Existing authored wide layouts should be preserved; missing wide layouts can be derived from the closest saved smaller breakpoint.

## PM-Ready Acceptance Criteria

- Users can save thousands of widgets without the dashboard becoming slow to open.
- Adding a widget remains fast on large dashboards.
- Unseen offscreen widgets do not refresh API data until they are visible or explicitly opened.
- The widget picker remains searchable when the catalog grows to thousands of entries.
- Dashboard saves update only changed records instead of rewriting every widget.
- Narrow widget states do not expose clipped titles or overlapping controls.
- 4K users see a dashboard that uses the extra screen width.
