# First-Wave Automated Coverage

## Scope

This first wave expands automated coverage around Boxento's highest-risk shared behavior without trying to cover every widget in the repo.

## Added Coverage

- Unit coverage for the local dashboard persistence contract in `tests/unit/localStorageProvider.test.ts`
  - personal dashboard layout persistence and legacy fallback restoration
  - non-personal dashboard storage isolation
  - widget persistence fallback restoration
  - dashboard-specific storage cleanup on delete
- Browser coverage for add/configure/delete on a representative interactive widget in `tests/e2e/dashboard-layout.spec.ts`
  - add a Quick Links widget from the selector
  - update widget settings and persist the config
  - add a link and confirm it survives reload
  - delete the widget and confirm widget/config cleanup

## Existing Coverage Kept In Scope

- dashboard layout drag/resize persistence
- multi-widget drag persistence on larger dashboards
- tablet breakpoint rendering
- representative responsive widget rendering checks

## Subsequent Coverage

- Unit coverage for app-level dashboard flow persistence helpers in `tests/unit/dashboardPersistence.test.ts`
  - scoped dashboard snapshot persistence during switching
  - personal dashboard legacy fallback restoration
  - fresh non-personal dashboard initialization and persistence
  - create/delete dashboard metadata and cleanup planning
- Browser coverage for multi-dashboard flows in `tests/e2e/dashboard-switching.spec.ts`
  - switching between personal and non-personal dashboards
  - restoring dashboard-scoped widget and layout state after reload
  - creating and deleting dashboards through the UI
  - confirming non-personal storage cleanup and personal/non-personal isolation

## Deferred Follow-Ups

- [SUS-17](https://linear.app/sushaantu/issue/SUS-17/expand-widget-coverage-for-richer-interactions-and-responsive-settings): richer widget interactions and responsive settings regressions for the next widget tranche
