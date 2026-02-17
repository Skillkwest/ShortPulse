# Styles Structure

Purpose: explain how CSS is split to keep files focused and under the line limit.

## Files and responsibilities
- `styles/globals.css`: Aggregator; only imports other CSS files.
- `styles/foundation.css`: Resets, tokens, typography, layout primitives, base page shells.
- `styles/ui-patterns.css`: Buttons, chips, panels, stat cards, preview tiles, shared UI atoms.
- `styles/workspace-shared.css`: Shared workspace primitives across routes.
- `styles/workspace-chrome.css`: Workspace shell, nav, and page chrome.
- `styles/workspace-dashboard.css`: Dashboard layout and tiles.
- `styles/workspace-tools.css`: Tools/feature card styling.
- `styles/workspace-media.css`: Media Library surfaces.
- `styles/workspace-profile.css`: Profile/account/billing surfaces.
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
- `styles/ai-studio-create-expert.tokens.css`: Expert create tokens, panel shell, and top-level spacing/heading defaults.
- `styles/ai-studio-create-expert-chat.css`: Expert inline chat shell, message presentation, and assistant/user text treatments.
- `styles/ai-studio-create-expert-output-generate.css`: Expert output-generate card/pill styling (history + inline generate CTA).
- `styles/ai-studio-create-expert-composer.css`: Expert composer input shell, attachment strip, and send-row controls.
- `styles/ai-studio-create-expert-controls.css`: Expert control rows, model/aspect/resolution selectors, character-mode toggle/picker states.
- `styles/ai-studio-create-expert-motion.css`: Expert-specific keyframes and reduced-motion overrides.
- `styles/ai-studio-create-expert-responsive.css`: Expert-specific responsive overrides at small breakpoints.

## Adding styles
- Prefer extending the feature sheet that matches the surface; avoid reintroducing a monolithic `globals.css`.
- If a new surface does not fit existing files, add a new CSS file and import it from `globals.css`.
- Aim to keep each file under ~500 lines; if it grows beyond that, document why and plan a split.
- Avoid deep selectors; keep class-based styling aligned with React components.

## Palette constraints
- Avoid the dark tones `#21211e`, `#1f201c`, and `#1e1e1b`; use `#1c1f20` as the panel/base tone across surfaces.

## Import order
`globals.css` imports in this order to maintain token availability and predictable overrides:
1) foundation
2) ui-patterns
3) workspace (shared/chrome/dashboard/tools/media/profile)
4) ai-studio (layout/coming-soon/canvas/controls/reference-properties)
5) prefabs (agent core + variants)
6) ai-studio (properties/text-properties/prompts/prompt-actions/model-picker/history/modals/responsive + expert-create split sheets)
7) performance (core/detail/responsive)
8) landing (core/sections)
9) auth + viewport lock
