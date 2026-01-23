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
- `styles/ai-studio-layout.css`: AI Studio chrome (page shell, hero strip, toolbar/column layout).
- `styles/ai-studio-canvas.css`: Reference grid and preview surfaces for AI Studio.
- `styles/ai-studio-controls.css`: Step cards, toggles, and aspect/model selectors.
- `styles/ai-studio-dropzones.css`: Regen dropzones and reference upload layouts.
- `styles/ai-studio-panels.css`: Prompt inputs, presets, history blocks, and model picker.
- `styles/ai-studio-modals.css`: Reference detail modal styling.
- `styles/ai-studio-responsive.css`: AI Studio responsive breakpoints.

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
4) ai-studio (layout/canvas/controls/dropzones/panels/modals/responsive)
5) performance (core/detail/responsive)
6) landing (core/sections)
