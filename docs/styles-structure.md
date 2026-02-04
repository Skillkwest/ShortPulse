# Styles Structure

Purpose: explain how CSS is split to keep files focused and under the line limit.

## Files and responsibilities
- `styles/globals.css`: Aggregator; only imports other CSS files.
- `styles/foundation.css`: Resets, tokens, typography, layout primitives, base page shells.
- `styles/ui-patterns.css`: Buttons, chips, panels, stat cards, preview tiles, shared UI atoms.
- `styles/workspace.css`: Dashboard/workspace chrome, module tiles, creator panels, auth/media layout.
- `styles/prefabs-agent.css`: Core styling for agent prefabs shared across features.
- `styles/prefabs-agent-variants.css`: Compact/variant treatments for agent prefabs (chat shell, compact buttons).
- `styles/performance-core.css`: Analytics chart shell, tooltips, filter bars, compact list cards.
- `styles/performance-detail.css`: Modal, trend cards, selection/detail treatments.
- `styles/performance-responsive.css`: Detail/responsive tweaks and focus states for analytics surfaces.
- `styles/landing-core.css`: Marketing nav/hero/core layout.
- `styles/landing-sections.css`: Marketing feature/pricing/FAQ sections and responsive rules.
- `styles/ai-studio-layout.css`: AI Studio chrome (page shell, hero strip, toolbar/column layout).
- `styles/ai-studio-coming-soon.css`: Temporary placeholders for templates, workflows, and gallery views.
- `styles/ai-studio-canvas.css`: Reference grid and preview surfaces for AI Studio.
- `styles/ai-studio-controls.css`: Step cards, toggles, and aspect/model selectors.
- `styles/ai-studio-reference-properties.css`: Reference panel dropzones, frame/model controls, and upload layouts.
- `styles/ai-studio-text-properties.css`: Text panel toggles, prompt actions, and generation controls.
- `styles/ai-studio-properties.css`: Properties panel scaffolding, control rows, selects.
- `styles/ai-studio-prompts.css`: Prompt inputs, mode toggles, prompt actions.
- `styles/ai-studio-prompt-actions.css`: Prompt CTAs, library buttons, action strips.
- `styles/ai-studio-model-picker.css`: Model picker button, modal, chips, tooltips.
- `styles/ai-studio-history.css`: Presets, history cards, status chips, inline error hints.
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
3) workspace (shared/chrome/dashboard/tools/media/profile)
4) ai-studio (layout/coming-soon/canvas/controls/reference-properties)
5) prefabs (agent core + variants)
6) ai-studio (properties/text-properties/prompts/prompt-actions/model-picker/history/modals/responsive)
7) performance (core/detail/responsive)
8) landing (core/sections)
9) auth + viewport lock
