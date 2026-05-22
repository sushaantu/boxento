# AI Agent Instructions

When you provide instructions in addition to technical stuff, also include product manager ready instructions.

## Boxento Widget UX Contract

Use this file as the source of truth when creating, updating, or reviewing Boxento widgets.

### Source Of Truth In Code

Read these files before making widget UX decisions:

- `docs/WIDGET_DEVELOPMENT.md`
- `src/components/widgets/common/WidgetShell.tsx`
- `src/components/widgets/common/WidgetSettingsDialog.tsx`
- `src/components/widgets/common/widgetHeaderStyles.ts`
- `src/components/dashboard/DashboardWidgetFrame.tsx`
- `src/components/widgets/index.ts`

Use these widgets as implementation anchors for size-spectrum behavior:

- `src/components/widgets/TodoWidget/index.tsx`
- `src/components/widgets/NotesWidget/index.tsx`
- `src/components/widgets/WeatherWidget/index.tsx`
- `src/components/widgets/QuickLinksWidget/index.tsx`
- `src/components/widgets/RSSWidget/index.tsx`

### Core Principle

Design every widget as a size spectrum, not a single squeezed layout:

1. `1x1` glance state
2. compact widget state
3. standard widget state
4. panel state
5. app state

As the widget gets larger, reveal more workflow, context, and controls.
Do not simply scale the same crowded UI up or down.

### Shell Rules

- Prefer `WidgetShell` for new or heavily refactored widgets.
- Keep the root layout aligned with Boxento's flex model: `widget-container`, `flex`, `h-full`, `flex-col`.
- Keep the content area resilient to resizing with `min-h-0`, `flex-1`, and deliberate overflow behavior.
- Use `contentClassName` on `WidgetShell` to adjust density by size instead of creating a second shell system.
- Keep the header visually integrated with content. Do not add a bottom border or separator line under the header.
- Keep the settings entry point in the header unless the widget is tiny or fully app-sized and the app layout already has a clearer control surface.

### Header Rules

- Hide the outer header in tiny mode.
- Prefer hiding the outer header in app mode when the app surface has its own title, toolbar, tabs, or filters.
- Use compact header spacing only when the widget is short or dense enough that the default header would crowd the content.
- Use a clear, short title that matches the widget's user value.
- Keep header actions minimal. The settings button is standard; add other actions only when they are truly primary.
- In one-column, tiny, or short-row sizes, do not show clipped titles such as `Weat...`. Hide the outer header and expose settings through a size-appropriate overlay/control when the standard header cannot fit.

### Size Rules

#### Tiny: `width === 1 && height === 1`

- Show one glanceable signal, one icon-led cue, or one tap target.
- Do not render dense forms, lists, or multiple competing actions.
- Do not render the standard header.
- Keep text extremely short and centered or intentionally aligned.
- If the only useful action is setup, opening settings from the tiny surface is acceptable.

#### Short Row: `height === 1 && width > 1`

- Use a compact header or compact inline summary.
- Show one-line status, metric, or next action.
- Avoid multi-line content that will overflow vertically.

#### Compact: typically `width <= 2` or `height <= 2`

- Prioritize the primary status or one small workflow.
- Reduce metadata and secondary controls.
- Favor truncation, chips, counters, or compact list items over paragraphs.
- Avoid tables, large forms, and nested panels.

#### Standard: typical default widget sizes

- Show the primary workflow clearly.
- Include the most important controls and enough context to understand the data.
- Keep density moderate and scanning easy.

#### Panel And App: typically `width >= 4 && height >= 4`, especially `width >= 6 && height >= 6`

- Expand into search, filters, tabs, secondary metadata, detail panes, inline editing, or richer previews when the widget's job benefits from them.
- Promote app-specific controls only when the larger surface materially improves the workflow.
- Avoid leaving large surfaces visually empty just because the small widget layout was stretched.

### State Rules

Support these states intentionally:

- loading
- empty
- error
- configured success
- read-only

#### Loading

- Rely on the dashboard `Suspense` fallback for component-load time.
- Use skeletons or subtle in-widget loading states for data refreshes, not full-screen spinners by default.
- Keep loading layout close to final layout to reduce visual jump.

#### Empty

- Explain what is missing in plain language.
- Offer the next step: configure, add an item, connect an account, or choose a source.
- Keep empty states calm and informative instead of decorative.

#### Error

- Show a scoped message tied to the failed task.
- Offer a recovery path when possible: retry, reconfigure, reconnect, or inspect settings.
- Do not dump raw error objects into the widget UI.

#### Read-Only

- Respect `config.readOnly` as a first-class mode.
- Hide settings, editing, creation, reorder, and destructive controls when the widget is read-only.
- Keep the widget fully legible and useful even when interaction is suppressed.

### Settings Rules

- Prefer `WidgetSettingsDialog` and `WidgetSettingsDialogFooter` for configuration flows.
- Keep draft form state local until Save when multiple fields are involved.
- Use immediate persistence only when the widget already has a stable inline editing pattern and the interaction is core to the widget.
- Put destructive actions in the footer using the destructive button variant.
- Route delete flows through `config.onDelete` and save flows through `config.onUpdate`.
- Do not hide core operational workflow inside settings if the user needs that action frequently in normal use.

### Content Rules

- Make the primary task obvious within two seconds of looking at the widget.
- Reduce chrome in smaller sizes and increase capability in larger ones.
- Keep text wrapping and truncation deliberate.
- Avoid accidental overflow, clipped controls, and stacked scrollbars.
- Audit narrow states for clipped headings and wide/4K states for wasted dashboard canvas.
- Avoid fixed pixel heights that break grid resizing.
- Use theme tokens and semantic utility classes instead of ad hoc colors.
- Introduce custom colors only when the data itself is semantic, such as status or category encoding.

### Registry Rules

- Set `defaultWidth`, `defaultHeight`, `minWidth`, and `minHeight` according to the real UX requirements of the widget.
- Only mark a widget as tiny-ready by adding it to `TINY_READY_WIDGET_TYPES` when it has a real `1x1` design.
- Keep registry descriptions user-facing and outcome-oriented.

### Accessibility And Interaction Rules

- Use proper button, input, and dialog labels.
- Keep keyboard access intact for primary actions.
- Avoid putting important click targets on drag-only surfaces without clear affordance.
- Stop propagation only where needed to protect dashboard interactions, not as a blanket pattern.
- Prefer shared UI primitives so focus states and semantics stay consistent.

### Review Checklist

Use this checklist when reviewing a widget:

- Did the change preserve existing visual styling unless it is explicitly fixing overflow, clipping, or broken recovery?
- Does the widget have a deliberate tiny, compact, standard, and large-surface story for the sizes it claims to support?
- Does it use the shared shell and settings primitives unless there is a good reason not to?
- Does the header remain borderless and visually integrated?
- Does it handle loading, empty, error, configured, and read-only states cleanly?
- Does the settings flow keep destructive actions in the standard footer pattern?
- Do one-column, tiny, and short-row states avoid clipped titles and overlapping controls?
- Does the dashboard use the available canvas on wide/4K displays without forcing a laptop-width grid?
- Does it avoid custom spacing and color systems that drift away from the rest of Boxento?
- If it supports `1x1`, was `TINY_READY_WIDGET_TYPES` updated?

### PM-Ready Acceptance Criteria Template

When summarizing widget UX changes, include a short PM-ready section covering:

- which widget sizes changed
- what the user sees in each size
- what changed in settings or destructive flows
- how loading, empty, error, and read-only states behave

Use concise, testable statements such as:

- The widget shows a glanceable tiny state without overflow or hidden critical text.
- Narrow widget states avoid clipped titles or overlapping controls.
- Performance changes do not add new hover effects, shadows, borders, or visual treatments.
- The compact state preserves the primary job of the widget and removes secondary clutter.
- The standard state exposes the main workflow and settings entry point.
- The large or app state expands into richer controls or detail views only when they improve the workflow.
- Loading, empty, error, and read-only states are understandable without reading code.
- Destructive actions remain inside settings and use the standard confirmation path.
