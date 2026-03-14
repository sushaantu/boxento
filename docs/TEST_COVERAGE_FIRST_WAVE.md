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

## Deferred Follow-Ups

- [SUS-16](https://linear.app/sushaantu/issue/SUS-16/add-automated-coverage-for-dashboard-switching-and-cross-dashboard): dashboard switching, create/delete flows, and cross-dashboard persistence isolation
- [SUS-17](https://linear.app/sushaantu/issue/SUS-17/expand-widget-coverage-for-richer-interactions-and-responsive-settings): richer widget interactions and responsive settings regressions for the next widget tranche
