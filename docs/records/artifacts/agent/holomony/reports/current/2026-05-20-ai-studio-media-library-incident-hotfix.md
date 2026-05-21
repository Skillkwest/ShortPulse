# AI Studio Media Library Incident Hotfix

Date: 2026-05-20
Environment: `production`
Surface:

- `ai-studio-panel`

## Incident

User-facing failure state observed in production:

- `Network issue while contacting the Media Library. Please retry.`
- `Unable to load media.`
- `Loaded 0 media items`

The panel was not proving a product-performance problem at that moment. It was proving an availability/reliability problem on the media-list open path.

## Root Cause

The canonical media-list client path for `/api/media/list` was not opting into the existing one-time transient network retry that sibling folder/prompt paths already used.

That meant a single transient browser-side fetch miss could collapse into an empty-looking panel failure on open.

## Hotfix

Changed:

- `frontend/features/media-library/logic/mediaListApi.ts`

Hotfix behavior:

- media-list requests now opt into `shortpulseRetryNetworkOnce: true`

This was intentionally narrow. It used the repo’s existing authenticated-fetch retry behavior rather than adding a second custom retry implementation inside the panel controller.

## Validation

Focused validation run for the incident lane:

- `npx vitest run features/media-library/logic/__tests__/mediaListApi.test.ts tests/api/media-list.test.ts`
- `npx eslint features/media-library/logic/mediaListApi.ts features/media-library/logic/__tests__/mediaListApi.test.ts`

Operational note:

- production deploy used an isolated clean build copy because the main repo had unrelated dirty files at the time of the incident response

## Current AI Studio Runtime Read

### All Media

- `sampleCount: 5`
- `visibleMediaSuccessRatio: 1`
- `averageRowCount: 20`
- `firstMediaPaintP95Ms: 1012`
- `stableContentSettleMsP95: 1419`
- `signBatchP95Ms: 917`
- `missingPreviewRatio: 0`
- `canonicalPreviewCoverageRatio: 1`
- `consoleErrorsPerOpen: 0`

### Images

- `sampleCount: 5`
- `visibleMediaSuccessRatio: 1`
- `averageRowCount: 6`
- `firstMediaPaintP95Ms: 859`
- `stableContentSettleMsP95: 1268`
- `signBatchP95Ms: 480`
- `missingPreviewRatio: 0`
- `canonicalPreviewCoverageRatio: 1`
- `consoleErrorsPerOpen: 0`

## Boundary

This report is the current AI Studio-only runtime read after the incident hotfix.

It does not replace the cross-surface retained baseline for Elements. Use:

- `reports/current/2026-05-19-approved-panel-baseline-refresh.md`

for the last paired approved-surface baseline refresh.
