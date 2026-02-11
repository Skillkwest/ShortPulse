# UI/UX Checklist

Use this checklist during audits to keep recommendations concrete and consistent.

## Visual clarity
- Verify one clear focal point per panel/step.
- Verify primary and secondary actions are visually distinct.
- Verify text hierarchy is obvious at a glance (title, support text, metadata).
- Verify spacing groups related controls and separates unrelated ones.
- Verify icon-only controls have visible labels or tooltips.

## Interaction quality
- Verify hover, active, disabled, and loading states exist for interactive controls.
- Verify critical actions provide immediate feedback (inline status, toast, or state change).
- Verify destructive or costly actions include a clear confirmation pattern when needed.
- Verify long-running actions show progress or waiting state.
- Verify controls avoid accidental double-submits and race-prone interactions.

## UX flow health
- Verify first-time users can complete the flow without hidden knowledge.
- Verify repeat users can complete the flow with minimal clicks.
- Verify error messages explain next action, not only failure.
- Verify empty states include a clear path forward.
- Verify defaults reduce decision fatigue and map to common use cases.

## Accessibility baseline
- Verify keyboard navigation and visible focus states for all interactive elements.
- Verify semantic markup and labels for inputs, toggles, and grouped controls.
- Verify practical tap targets on mobile-sized layouts.
- Verify contrast for text, icons, and control borders against panel backgrounds.
- Verify motion does not block comprehension or interaction.

## Responsive behavior
- Verify no clipping/overflow for core workflows on narrow screens.
- Verify sticky/fixed panels do not obscure key controls.
- Verify content density remains usable on both mobile and desktop.
- Verify side panels collapse progressively without losing critical actions.

## Trend-fit screen
- Prefer trends that increase comprehension, trust, or speed.
- Consider: clearer section framing, progressive disclosure, stronger state communication, cleaner empty/loading states.
- Reject: decorative animation, novelty layouts, or visual effects that reduce readability.
- Limit trend recommendations to one or two high-confidence ideas per audit.

## Recommendation quality bar
- Tie each recommendation to a specific file and UI surface.
- Include user impact and measurable expected outcome.
- Keep implementation scope small for first pass.
- Prioritize recommendations by impact/effort/confidence.
