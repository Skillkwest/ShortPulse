# Assets Workspace

Purpose: hold non-runtime design and reference assets that support ShortPulse product, brand, and UI work without becoming app code or canonical product behavior docs.

## Scope

Use `assets/` for:

- design source files,
- exported mockups or screenshots kept for reference,
- brand assets,
- other non-runtime visual material that should stay outside `frontend/public/`.

## Guardrails

- This folder is not the source of truth for shipped UI behavior, route contracts, or implementation details.
- Runtime web assets that the app serves directly belong in `frontend/public/`.
- Durable behavior, workflow, and design decisions belong under `docs/`.
- If an asset is only temporary working scratch and no longer supports an active lane, remove it instead of letting the folder become a dump.

## Current Layout

- `design/`: design source files, mockups, reference screenshots, and brand material.
