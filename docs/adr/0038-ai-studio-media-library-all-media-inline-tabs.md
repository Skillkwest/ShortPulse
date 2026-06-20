# ADR 0038: AI Studio Media Library All Media Inline Tabs

## Status
Accepted; updated by the shipped five-tab root contract that adds `Audio` as a dedicated root tab while keeping `Prompts` prompt-only.

## Date
2026-03-13

## Context
`All Media` in the AI Studio Media Library panel previously rendered as three collapsible sections (`Images`, `Videos`, `Prompts`) within the same root folder. The product direction changed to a tabbed organizer pattern that keeps all content in one folder while reducing vertical clutter and making media-type switching explicit.

Existing constraints remain:
- `all_items` (`All Media`) is still the immutable root folder.
- Folder membership semantics and storage/data contracts remain unchanged.
- Media list/prompt list APIs already support type-specific querying.

## Decision
Adopt inline root tabs for `All Media` in AI Studio Media Library:
1. Render one root tab strip in `All Media` with `All Media`, `Images`, `Videos`, `Audio`, and `Prompts`.
2. Tabs are view filters only inside `All Media`; they do not create new folders or move data.
3. `All Media` is the aggregate media-only view for saved image, video, and audio assets; saved prompt records remain in `Prompts`.
4. `Images`, `Videos`, and `Audio` tabs use existing media list filtering (`mediaKind=images|videos|audio`).
5. `Prompts` tab uses existing prompts list API.
6. Root media pagination remains a single global footer control for media tabs.

This decision supersedes only the `All Media` presentation detail in ADR 0032 (sectioned root rendering), while preserving ADR 0032 folder/domain semantics.

## Consequences
Positive:
1. Keeps `All Media` as a single master folder while improving scanability and navigation.
2. Reuses existing API contracts and avoids schema/backend changes.
3. Preserves existing gesture, preview, drag/drop, and delete contracts.

Tradeoffs:
1. Non-active tab counts are based on currently loaded tab data unless proactively fetched.
2. Tab switching triggers a fresh first-page load for deterministic behavior.

## Alternatives considered
1. Keep collapsible sections: rejected for higher visual clutter and less explicit media-type switching.
2. Create separate folders for images/videos/prompts: rejected because it would violate root-folder semantics and introduce data/model complexity.
