# D-Bug Handoff - Media Library Search Empty-State Mismatch

Historical note: the standalone Media Library page was removed from the product. Keep this handoff as reference only and reopen it only if the same bug is reproduced on current AI Studio media surfaces.

## Issue

- Surface: production Media Library
- Severity: medium
- User-facing problem: when a search query returns no uploaded-image matches, the route says `No images uploaded yet.` instead of saying no search results were found

## Why This Matters

- this reads like data loss, not a search miss
- a real user can believe their uploads disappeared when the actual problem is just a query with zero matches

## Repro

1. Sign into production as the Beeper audit user.
2. Open the former standalone Media Library page.
3. Stay on `Uploaded Images`.
4. Enter a no-match query such as `zzzz_beeper_no_match`.
5. Observe:
   - the count chip drops to `0 files`
   - the content area says `No images uploaded yet.`

## Expected

- a no-match search state should render search-aware copy such as `No results found` or equivalent query-aware text

## Actual

- the route renders the base empty-library copy for the active tab

## Evidence

- Beeper retained report:
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-media-library-search-lane.md`
- Beeper full report:
  - `beeper/reports/2026-05-15-production-media-library-search-lane.md`
- Run packet:
  - `beeper/runs/2026-05-15-163023-prod-media-library-search-lane`
- Primary screenshot:
  - `beeper/runs/2026-05-15-163023-prod-media-library-search-lane/evidence/media-search-04-no-match-empty-state.png`
- JSON summary:
  - `beeper/runs/2026-05-15-163023-prod-media-library-search-lane/evidence/media-library-search-summary.json`

## Likely Code Surfaces

- empty-state copy resolver:
  - `frontend/features/media-library/components/MediaGallerySection.tsx:98`
- search input and count surface:
  - `frontend/features/media-library/components/MediaFiltersPanel.tsx:79`
- filtered visible-count wiring:
  - former route-owned `media-library.tsx` wiring in the removed standalone page
- current test coverage:
  - `frontend/features/media-library/components/__tests__/MediaGallerySection.test.tsx:81`

## First Debug Read

- `visibleCount` is already query-aware in the former standalone Media Library page
- the likely mismatch is presentation logic: `MediaGallerySection.tsx` resolves empty copy only from `activeTab`, not from `activeMediaQuery`
- likely fix shape:
  - if `activeMediaQuery.trim()` is non-empty and `files.length === 0`, render query-aware no-results copy instead of tab-empty copy
  - add tests for a searched no-match image state and probably a searched no-match prompt state

## Suggested Owner After Diagnosis

- D-Bug can confirm the UI-state bug and expected fix surface
- Gear Ball or the main coding lane can implement once diagnosis is settled
