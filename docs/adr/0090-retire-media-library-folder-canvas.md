# ADR 0090: Retire Media Library Folder Canvas

## Status

Accepted

## Date

2026-06-03

## Context

AI Studio already has one canonical user-facing canvas surface: the shared right-rail `Canvas` that is available across the primary workflows.

The Media Library folder canvas had become a second, folder-scoped canvas subsystem with its own:

1. React component and snapshot model,
2. API routes and server persistence service,
3. tests and e2e audit coverage,
4. docs and interaction contracts.

By the time of this decision, the visible Media Library product surface was already browse-first and the panel hosts had hard-disabled folder-canvas rendering. Keeping the dormant subsystem in the repo added contract drift and maintenance cost without providing shipped behavior.

The user requirement for this lane is strict:

1. keep Media Library panels intact,
2. keep folder CRUD, hierarchy, and membership behavior intact,
3. keep all other Media Library functionality intact,
4. do not touch the shared right-rail Canvas behavior.

## Decision

Retire the Media Library folder canvas as a runtime feature.

1. Media Library custom folders are browse/list/membership surfaces only; they do not own independent canvas scenes.
2. The shared right-rail `Canvas` remains the only shipped canvas surface in AI Studio.
3. Remove the folder-canvas component, snapshot logic, API routes, server persistence service, and feature-specific tests.
4. Update live route, SOP, API, and README documentation so they no longer advertise folder-canvas behavior as current product contract.
5. Preserve existing Media Library folder CRUD, folder nesting, membership, ingest, detail modal, and project-global folder authority behavior.
6. Do not change the shared right-rail Canvas interaction model in this removal lane.

## Data and migration posture

This retirement is intentionally non-destructive to historical data in the first pass.

1. Legacy schema and migration history may remain on disk as historical record.
2. Existing `media_folder_canvas_states` data is no longer runtime authority once the folder-canvas API and client surfaces are removed.
3. Any future destructive database cleanup, including dropping legacy folder-canvas tables or rows, requires its own explicit migration lane and operator sign-off.

## Consequences

1. AI Studio now has one shipped canvas concept instead of a shared right-rail canvas plus dormant folder canvases.
2. Media Library folder behavior is simpler to reason about because folders only govern structure, browsing, and membership.
3. Historical ADRs and migration docs may still mention folder-canvas persistence as part of prior architecture, but they are no longer current runtime guidance.
