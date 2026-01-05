# Styles Structure

Purpose: explain how CSS is split to keep files focused and under the line limit.

## Files and responsibilities
- `styles/globals.css`: Aggregator; only imports other CSS files.
- `styles/foundation.css`: Resets, tokens, typography, layout primitives, base page shells.
- `styles/ui-patterns.css`: Buttons, chips, panels, stat cards, preview tiles, shared UI atoms.
- `styles/workspace.css`: Dashboard/workspace chrome, module tiles, creator panels, auth/media layout.
- `styles/performance-core.css`: Analytics chart shell, tooltips, filter bars, compact list cards.
- `styles/performance-detail.css`: Modal, trend cards, selection/detail treatments.
- `styles/performance-responsive.css`: Detail/responsive tweaks and focus states for analytics surfaces.
- `styles/landing-core.css`: Marketing nav/hero/core layout.
- `styles/landing-sections.css`: Marketing feature/pricing/FAQ sections and responsive rules.
- `styles/workspace-ai-studio.css`: AI Studio-specific layout overrides (preview column visibility, reference canvas grid spacing, dropzone controls, Studio Preview card styling).

## Adding styles
- Prefer extending the feature sheet that matches the surface; avoid reintroducing a monolithic `globals.css`.
- If a new surface does not fit existing files, add a new CSS file and import it from `globals.css`.
- Keep each file well under 500 lines; split by concern if approaching the limit.
- Avoid deep selectors; keep class-based styling aligned with React components.

## Import order
`globals.css` imports in this order to maintain token availability and predictable overrides:
1) foundation
2) ui-patterns
3) workspace
4) performance (core/detail/responsive)
5) landing (core/sections)
